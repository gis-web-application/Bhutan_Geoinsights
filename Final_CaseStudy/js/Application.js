import AppBase from "./support/AppBase.js";
import AppLoader from "./loaders/AppLoader.js";
import SignIn from "./apl/SignIn.js";
import ViewLoading from "./apl/ViewLoading.js";
import MapScale from './apl/MapScale.js';
import { createPolarChart } from "./apl/CreateChart.js";
import { uploadData } from "./apl/UploadData.js";

// Show the custom hospital popup with dynamic content
export function showHospitalPopup(htmlContent) {
  document.getElementById('hospital-popup-content').innerHTML = htmlContent;
  document.getElementById('hospital-info-popup').style.display = 'block';
}

// Close button logic
document.getElementById('close-hospital-popup').onclick = function() {
  document.getElementById('hospital-info-popup').style.display = 'none';
};


class Application extends AppBase {
  // PORTAL //
  portal;

  constructor() {
    super();

    // LOAD APPLICATION BASE //
    super.load().then(() => {
      // APPLICATION LOADER //
      const applicationLoader = new AppLoader({ app: this });
      applicationLoader.load().then(({ portal, group, map, view }) => {
        // PORTAL //
        this.portal = portal;

        // SET APPLICATION DETAILS //
        this.setApplicationDetails({map, group});

        // VIEW SHAREABLE URL PARAMETERS //
        this.initializeViewShareable({view});
        
        // USER SIGN-IN //
        this.configUserSignIn();

        // APPLICATION //
        this.applicationReady({portal, group, map, view}).catch(this.displayError).then(() => {
          // HIDE APP LOADER //
          document.getElementById('app-loader').toggleAttribute('hidden', true);
        });
      }).catch(this.displayError);
    }).catch(this.displayError);
  }


  /**
   * Initialize panel state management
   */
  initializePanelState() {
    const leftPanel = document.querySelector('calcite-shell-panel[slot="panel-start"]');
    const rightStatsPanel = document.getElementById('panel-stats-end');

    // Load saved states from localStorage
    const leftPanelCollapsed = localStorage.getItem('leftPanelCollapsed') === 'true';
    const rightStatsCollapsed = localStorage.getItem('rightStatsCollapsed') !== 'false';

    leftPanel.collapsed = leftPanelCollapsed;
    rightStatsPanel.collapsed = rightStatsCollapsed;

    // Save states when changed
    leftPanel.addEventListener('calciteShellPanelToggle', () => {
      localStorage.setItem('leftPanelCollapsed', leftPanel.collapsed);
    });

    rightStatsPanel.addEventListener('calciteShellPanelToggle', () => {
      localStorage.setItem('rightStatsCollapsed', rightStatsPanel.collapsed);
    });
  }

  /**
   * Configure user sign-in
   */
  configUserSignIn() {
    const signInContainer = document.getElementById("sign-in-container");
    if (signInContainer) {
      const signIn = new SignIn({container: signInContainer, portal: this.portal});
    }
  }

  /**
   * Configure the map view
   */
  configView({view}) {
    return new Promise((resolve, reject) => {
      if (view) {
        require([
          'esri/core/reactiveUtils',
          'esri/widgets/Popup',
          'esri/widgets/Home',
          'esri/widgets/Search',
          'esri/widgets/LayerList',
          'esri/widgets/Slider',
          'esri/widgets/Legend',
          'esri/widgets/BasemapGallery',
          'esri/widgets/Expand',
          'esri/widgets/Measurement',
          'esri/widgets/Locate'
        ], (reactiveUtils, Popup, Home, Search, LayerList, Slider, Legend, BasemapGallery, Expand, Measurement, Locate) => {
          // VIEW AND POPUP //
          view.set({
            constraints: { snapToZoom: false },
            highlightOptions: {
              fillOpacity: 0,
            },
            popup: new Popup({
              dockEnabled: true,
              dockOptions: {
                buttonEnabled: false,
                breakpoint: false,
                position: "top-right",
              },
            }),          
          });

          // SEARCH //
          const search = new Search({
            view: view,
            locationEnabled: false,
            resultGraphicEnabled: false,
            popupEnabled: false,
          });

          const searchExpand = new Expand({
            expandTooltip: "Search",
            view: view,
            content: search
          });
          view.ui.add(searchExpand, { position: "top-left", index: 0 });

          // HOME //
          const home = new Home({ view });
          view.ui.add(home, { position: "top-left", index: 1 });

          const locateWidget = new Locate({
            view: view,
            locationEnabled: true
          });
          view.ui.add(locateWidget, { position: "top-left", index: 3 });

          // MEASUREMENT TOOL //
          const measurement = new Measurement({
            view: view,
            container: document.createElement("div"),
            linearUnit: "kilometers",
            areaUnit: "square-kilometers"
          });

          view.ui.add(measurement, "bottom-right");

          // Toolbar setup
          const toolbarDiv = document.createElement("div");
          toolbarDiv.id = "toolbarDiv";
          toolbarDiv.className = "esri-component esri-widget";
          toolbarDiv.innerHTML = `
            <button id="distance" class="esri-widget--button esri-interactive esri-icon-measure-line" title="Distance Measurement Tool"></button>
            <button id="area" class="esri-widget--button esri-interactive esri-icon-measure-area" title="Area Measurement Tool"></button>
            <button id="clear" class="esri-widget--button esri-interactive esri-icon-trash" title="Clear Measurements"></button>
          `;
          view.ui.add(toolbarDiv, "top-right");

          // Event listeners
          document.getElementById("distance").addEventListener("click", () => {
            measurement.activeTool = "distance";
            toggleActiveButton("distance");
          });

          document.getElementById("area").addEventListener("click", () => {
            measurement.activeTool = "area";
            toggleActiveButton("area");
          });

          document.getElementById("clear").addEventListener("click", () => {
            measurement.clear();
            document.querySelectorAll("#toolbarDiv button").forEach(btn => {
              btn.classList.remove("active");
            });
          });

          function toggleActiveButton(activeId) {
            document.querySelectorAll("#toolbarDiv button").forEach(btn => {
              btn.classList.toggle("active", btn.id === activeId);
            });
          }
          // MAP SCALE //
          const mapScale = new MapScale({view});
          view.ui.add(mapScale, {position: 'bottom-right', index: 0});

          // LAYER LIST //
          const layerList = new LayerList({
            container: "layer-list-container",
            view: view,
            visibleElements: { statusIndicators: true },
            listItemCreatedFunction: (evt) => {
              const item = evt.item;
              const layer = item.layer;

              // Hide all non-INDEX_INFO layers (except basemaps) by default
              if (
                layer.title !== "INDEX_INFO" &&
                layer.type !== "basemap" &&
                !layer.isUploaded // Only hide if NOT uploaded
              ) {
                item.visible = false;
                layer.visible = false;
              }

              // Add opacity slider to EVERY layer (including hidden ones)
              item.actionsSections = [{
                title: "Opacity",
                className: "esri-icon-up",
                id: "increase-opacity"
              }];

              const slider = new Slider({
                min: 0,
                max: 100,
                values: [layer.opacity * 100], // Current opacity
                steps: [0, 25, 50, 75, 100],
                snapOnClickEnabled: true,
                tickConfigs: [{ 
                  mode: "position", 
                  values: [0, 25, 50, 75, 100],
                  labelsVisible: false 
                }],
                visibleElements: { 
                  labels: false, 
                  rangeLabels: true 
                }
              });

              item.panel = {
                content: slider,
                className: "esri-icon-sliders-horizontal",
                title: "Change layer opacity",
                open: false,
              };

              // Update layer opacity when slider changes
              slider.on("thumb-drag", (evt) => {
                layer.opacity = evt.value / 100;
              });

              // Format percentage display
              slider.labelFormatFunction = (value, type) => 
                type === "value" ? value : `${value}%`;
            }
          });


           // LEGEND //
          const legendPanel = new Legend({
            container: "legend-container",
            view: view,
            layerInfos: view.map.allLayers
              .filter((layer) => layer.title !== "INDEX_INFO") // Exclude risk layers
              .map((layer) => ({ layer })), // Map remaining layers to layerInfos
          });

          // LEGEND ON MAP //
          // LEGEND ON MAP //
          const riskLayer = view.map.allLayers.find((layer) => layer.title === 'INDEX_INFO');
          const legend = new Legend({
            view: view,
            layerInfos: [
              {
                layer: riskLayer
              }
            ]
          });

          // Check if the legendExpand widget already exists
          let legendExpand = view.ui.find("legendExpand");
          if (!legendExpand) {
            legendExpand = new Expand({
              id: "legendExpand",
              expandTooltip: "Legend",
              view: view,
              content: legend,
              expanded: true
            });

            // Sync expanded state (add the watcher only once)
            legendExpand.watch("expanded", (isExpanded) => {
              console.log(`Legend is now ${isExpanded ? "expanded" : "collapsed"}`);
            });

            view.ui.add(legendExpand, { position: "bottom-left", index: 0 });
          }

          // BASEMAP GALLERY //
          const basemapGallery = new BasemapGallery({
            view: view,
            container: 'basemap-gallery-container', // Ensure this matches your container ID
            source: {
              query: {
                 // Adjust query as needed
              }
            }
          });

          // VIEW LOADING INDICATOR //
          const viewLoading = new ViewLoading({ view: view });
          view.ui.add(viewLoading, "bottom-right");

          // HOSPITALS LAYER //
          const hospitalsLayer = view.map.allLayers.find(l => l.title === "HOSPITALS_INFO");
          if (hospitalsLayer) {
            // Alert logic (unchanged)
            let hideHospitalAlert = false; // session variable

            const hospitalAlert = document.getElementById('hospital-info-alert');
            const hideCheckbox = document.getElementById('hide-hospital-alert-checkbox');

            // Defensive: Only add listeners if elements exist
            if (hideCheckbox && hospitalAlert) {
              hideCheckbox.addEventListener('calciteCheckboxChange', (e) => {
                hideHospitalAlert = e.target.checked;
                if (hideHospitalAlert) {
                  hospitalAlert.open = false;
                  hospitalAlert.hidden = true;
                } else {
                  // If unchecked, show alert again if layer is visible
                  if (hospitalsLayer.visible) {
                    hospitalAlert.hidden = false;
                    hospitalAlert.open = true;
                  }
                }
              });

              // Show alert when layer is made visible, unless user opted out
              hospitalsLayer.watch("visible", (isVisible) => {
                if (isVisible && !hideHospitalAlert) {
                  hospitalAlert.hidden = false;
                  hospitalAlert.open = true;
                } else {
                  hospitalAlert.open = false;
                  hospitalAlert.hidden = true;
                }
              });
            }
          }

          resolve();
        });
      } else { resolve(); }
    });
  }

  /**
   * Initialize upload data functionality
   */
  initializeUploadData({ portal, map, view }) {
    const uploadForm = document.getElementById('uploadForm');
    const inFile = document.getElementById('inFile');
    const uploadBtn = document.getElementById('upload-btn');
    const removeBtn = document.getElementById('remove-btn');
    const uploadLoader = document.getElementById('upload-loader');
    const appAddData = document.getElementById('app-add-data');

    // Store uploaded layers
    let uploadedLayers = [];

    // Enable/disable upload button based on file selection
    inFile.addEventListener('change', (event) => {
      uploadBtn.disabled = !event.target.files.length;
    });

    // Upload button click handler
    uploadBtn.addEventListener('click', async () => {
      const file = inFile.files[0];
      if (!file) return;

      // Supported file extensions
      const supportedExtensions = ['zip', 'csv', 'geojson', 'json', 'shp'];
      const fileExtension = file.name.split('.').pop().toLowerCase();
      // Example: 10MB max file size
      const maxSize = 10 * 1024 * 1024;

      // Get alert and message div
      const messageDiv = appAddData.querySelector('div[slot="message"]');

      // Check file extension
      if (!supportedExtensions.includes(fileExtension)) {
        messageDiv.textContent = 'Unsupported file type. Please upload a ZIP, CSV, GeoJSON, JSON, or SHP file.';
        appAddData.kind = 'danger';
        appAddData.open = true;
        uploadForm.reset();
        uploadBtn.disabled = true;
        return;
      }

      // Check file size
      if (file.size > maxSize) {
        messageDiv.textContent = 'File is too large. Maximum allowed size is 10MB.';
        appAddData.kind = 'danger';
        appAddData.open = true;
        uploadForm.reset();
        uploadBtn.disabled = true;
        return;
      }

      try {
        // Show loading state
        uploadLoader.hidden = false;
        uploadBtn.disabled = true;
        removeBtn.disabled = true;

        // Process the file
        const result = await uploadData(portal, map, view, file);

        // Store the uploaded layers
        uploadedLayers = result.layers;

        // Mark uploaded layers and add to map if not already added
        uploadedLayers.forEach(layer => {
          layer.isUploaded = true;
          if (!map.layers.includes(layer)) {
            map.add(layer);
          }
        });

        // Show success message
        messageDiv.textContent = 'Data uploaded successfully!';
        appAddData.kind = 'success';
        appAddData.open = true;
        // Reset form
        uploadForm.reset();
        uploadBtn.disabled = true;
        removeBtn.disabled = false;
      } catch (error) {
        messageDiv.textContent = `Upload failed: ${error.message}`;
        appAddData.kind = 'danger';
        appAddData.open = true;
      } finally {
        uploadLoader.hidden = true;
        uploadBtn.disabled = false;
        removeBtn.disabled = false;
      }
    });

    // Remove button click handler
    removeBtn.addEventListener('click', () => {
      const messageDiv = appAddData.querySelector('div[slot="message"]');
      try {
        if (uploadedLayers.length > 0) {
          // Show loading state
          uploadLoader.hidden = false;
          removeBtn.disabled = true;

          // Remove all uploaded layers
          map.removeMany(uploadedLayers);
          uploadedLayers = [];

          // Show success message
          messageDiv.textContent = 'Uploaded data removed successfully!';
          appAddData.kind = 'success';
          appAddData.open = true;

          // Reset form
          uploadForm.reset();
          uploadBtn.disabled = true;
        } else {
          messageDiv.textContent = 'No uploaded data to remove';
          appAddData.kind = 'warning';
          appAddData.open = true;
        }
      } catch (error) {
        messageDiv.textContent = `Failed to remove data: ${error.message}`;
        appAddData.kind = 'danger';
        appAddData.open = true;
      } finally {
        uploadLoader.hidden = true;
        removeBtn.disabled = false;
      }
    });
  }

   initializePolarChart() {
    const demoChartNode = document.getElementById('demographics-polar-chart');
    const demoLabels = [
      "Male (%)",
      "Female (%)",
      "Children <5 (%)",
      "Elderly 65+ (%)"
    ];
    // Create the chart if the node exists
    this.polarChart = demoChartNode ? createPolarChart(demoChartNode, demoLabels) : null;
    if (this.polarChart) {
      // Use the same color and border as your reference code
      this.polarChart.data.datasets[0].backgroundColor = [
        "rgba(62, 142, 222, 0.15)", // Subtle blue fill
        "rgba(62, 142, 222, 0.15)",
        "rgba(62, 142, 222, 0.15)",
        "rgba(62, 142, 222, 0.15)"
      ];
      this.polarChart.data.datasets[0].borderColor = [
        "#3E8EDE", "#3E8EDE", "#3E8EDE", "#3E8EDE"
      ];
      this.polarChart.data.datasets[0].borderWidth = 0.5;
      this.polarChart.update();
      console.log("Polar chart initialized!");
    } else {
      console.warn("Polar chart NOT initialized: Canvas not found.");
    }

    /**
     * Clear polar chart data
     */
    this.clearPolarChart = () => {
      if (this.polarChart) {
        this.polarChart.data.datasets[0].data = [0, 0, 0, 0];
        this.polarChart.update();
      }
    };

    /**
     * Update polar chart with feature data
     */
    this.updatePolarChart = (feature) => {
      if (!feature) {
        this.clearPolarChart();
        return;
      }
      // Get values from feature
      const totalPop = Number(feature.getAttribute("total_popu")) || 0;
      const male = Number(feature.getAttribute("male")) || 0;
      const female = Number(feature.getAttribute("female")) || 0;
      const children = Number(feature.getAttribute("age__5")) || 0;
      const elderly = Number(feature.getAttribute("age__65")) || 0;
      // Calculate percentages
      const data = totalPop > 0
        ? [
            (male / totalPop) * 100,
            (female / totalPop) * 100,
            (children / totalPop) * 100,
            (elderly / totalPop) * 100
          ]
        : [0, 0, 0, 0];
      this.polarChart.data.datasets[0].data = data;
      this.polarChart.update();
    };
  }


  /**
   * Initialize display details functionality
   */
  initializeDisplayDetails({view}) {
    if (view) {
      require([
        "esri/core/reactiveUtils"
      ], (reactiveUtils) => {
        // DEFAULT EXTENT //
        const defaultView = view.center;
        const defaultZoom = view.zoom;

        const numberFormatter = new Intl.NumberFormat('en-US');

        // FEATURE LAYER //
        const layerTitle = "INDEX_INFO";
        const featureLayer = view.map.allLayers.find((layer) => layer.title === layerTitle);

        const adminNameNode = document.getElementById('admin-name');
        const adminTitleNode = adminNameNode.querySelector('[slot="title"]');
        const adminMessageNode = adminNameNode.querySelector('[slot="message"]');
        const adminDescriptiveNode = document.getElementById('admin-descriptive');
        const populationLabel = document.getElementById('total-population-label');
        const maleLabel = document.getElementById('male-population-label');
        const femaleLabel = document.getElementById('female-population-label');
        const householdLabel = document.getElementById('total-household-label');
        const age5label = document.getElementById('age-5-label');
        const age65label = document.getElementById('age-65-label');
        const withelectricitylabel = document.getElementById('with-electricity-label');
        const withoutelectricitylabel = document.getElementById('without-electricity-label');
        const withinternetlabel = document.getElementById('with-internet-label');
        const withoutinternetlabel = document.getElementById('without-internet-label');
        const schoolslabel = document.getElementById('schools-label');
        const healthlabel = document.getElementById('health-label');
        const popDensityLabel = document.getElementById('population-density-label');

        /**
         * Clear details display
         */
        this.clearDetails = (view, layerView) => {
          if (layerView) {
            // CLEAR EFFECTS //
            layerView.featureEffect = null;
          } else {
            console.warn("layerView is null or undefined. Cannot clear featureEffect.");
          }

          if (view) {
            // ZOOM TO DEFAULT EXTENT //
            view.goTo(
              {
                center: defaultView,
                zoom: defaultZoom,
              },
              {
                animate: true,
                duration: 1000,
              }
            );
          } else {
            console.warn("view is null or undefined. Cannot reset map view.");
          }

          // CLEAR CONTENT OF DOM ELEMENTS (WITH NULL CHECKS)
          const setInnerHTML = (element, value, label = "") => {
            if (element) {
              element.innerHTML = value;
            } else {
              console.warn(`Element is null or undefined for label: ${label}`);
            }
          };

          setInnerHTML(adminTitleNode, "Click on the map to get information");
          setInnerHTML(adminMessageNode, "");
          setInnerHTML(adminDescriptiveNode, "");
          setInnerHTML(populationLabel, "-.-");
          setInnerHTML(maleLabel, "-.-");
          setInnerHTML(femaleLabel, "-.-");
          setInnerHTML(householdLabel, "-.-");
          setInnerHTML(popDensityLabel, "-.-");
          setInnerHTML(age5label, "-.-");
          setInnerHTML(age65label, "-.-");
          setInnerHTML(withelectricitylabel, "-.-");
          setInnerHTML(withoutelectricitylabel, "-.-");
          setInnerHTML(withinternetlabel, "-.-");
          setInnerHTML(withoutinternetlabel, "-.-");
          setInnerHTML(schoolslabel, "-.-");
          setInnerHTML(healthlabel, "-.-");
        };

        /**
         * Update details with feature data
         */
        this.updateDetails = (feature, layerView) => {
          // APPLY EFFECTS TO SELECTED FEATURE //
          layerView.featureEffect = {
            filter: {
              where: `id_2 = ${feature.getAttribute("id_2")}`
            },
            excludedLabelsVisible: true,
            includedEffect: "opacity(30%)",
          };

          // ZOOM TO SELECTED ADMIN //
          view.goTo({
              center: feature.geometry.extent,
              center: feature.geometry.centroid,
              zoom: 10
            },{
              animate: true,
              duration: 1000
            }
          );
          //Get the risk score 
          const densityScore = feature.getAttribute("pd")

          //Classify the risk into 5 categories
          let densityClass;
          if (densityScore <= 0.2) densityClass = "Very Low";
          else if (densityScore <= 0.4) densityClass = "Low";
          else if (densityScore <= 0.6) densityClass = "Moderate";
          else if (densityScore <= 0.8) densityClass = "High";
          else densityClass = "Very High";

          //Convert risk score to scale
          const densityScoureOutof10 = (densityScore*10).toFixed(1);

          // UPDATE RISK SCORE AND ADMIN NAME//
          adminTitleNode.innerHTML = `Population Density Index is <b>${densityClass}</b> (Score: <b>${densityScoureOutof10}</b> out of 10)`
          let adminName = [];
          adminName.push(feature.getAttribute("name_2"));
          adminName.push(feature.getAttribute("name_1"));
          adminMessageNode.innerHTML = adminName.join(", ");

          // UPDATE KEY INDICATORS //
          adminDescriptiveNode.innerHTML = `The population density index rating is <b>${densityClass} (Score: ${densityScoureOutof10} out of 10)</b> for <b>${adminName.slice(0, 3).join(", ")}</b> when compared to the rest of the gewogs in ${feature.getAttribute("name_1")}.`

          // Calculate and display population density
          const totalPop = Number(feature.getAttribute("total_popu")) || 0;
          const area = Number(feature.getAttribute("area")) || 0; // area in sq km
          const popDensity = area > 0 ? (totalPop / area).toFixed(2) : "--.--";

          // Update the population density cell in the table
          const popDensityLabel = document.getElementById('population-density-label');
          if (popDensityLabel) {
            popDensityLabel.innerHTML = popDensity;
          }

          populationLabel.innerHTML = numberFormatter.format(feature.getAttribute("total_popu"));
          maleLabel.innerHTML = numberFormatter.format(feature.getAttribute("male"));
          femaleLabel.innerHTML = numberFormatter.format(feature.getAttribute("female"));
          householdLabel.innerHTML = numberFormatter.format(feature.getAttribute("total_hh"));
          age5label.innerHTML = numberFormatter.format(feature.getAttribute("age__5"));
          age65label.innerHTML = numberFormatter.format(feature.getAttribute("age__65"));
          withelectricitylabel.innerHTML = numberFormatter.format(feature.getAttribute("hh_we"));
          withoutelectricitylabel.innerHTML = numberFormatter.format(feature.getAttribute("hh_woe"));
          withinternetlabel.innerHTML = numberFormatter.format(feature.getAttribute("hh_won"));
          withoutinternetlabel.innerHTML = numberFormatter.format(feature.getAttribute("hh_wn"));
          schoolslabel.innerHTML = numberFormatter.format(feature.getAttribute("no_edu"));
          healthlabel.innerHTML = numberFormatter.format(feature.getAttribute("no_hlth"));
        };
      });
    }
  }

  /**
   * Initialize map display functionality
   */
  initializeMapDisplay({ view }) {
    if (view) {
      require([
        "esri/core/reactiveUtils",
        "esri/smartMapping/renderers/color",
      ], (reactiveUtils, colorRendererCreator) => {
        // FEATURE LAYER //
        const layerTitle = "INDEX_INFO";
        const featureLayer = view.map.allLayers.find((layer) => layer.title === layerTitle);
  
        // Enable popups ONLY for HOSPITALS_INFO, disable for others
        view.map.allLayers.forEach((layer) => {
          if (layer.title === "HOSPITALS_INFO") {
            layer.popupEnabled = false;
          } else {
            layer.popupEnabled = false;
          }
        });
  
        if (featureLayer) {
          featureLayer.opacity = 1;
  
          view.whenLayerView(featureLayer).then((layerView) => {
            reactiveUtils
              .whenOnce(() => !layerView.updating)
              .then(() => {
                generateRenderer();
              });
          });
  
          // SET COLOR THEME //
          const riskColor = ["#FFFDFB", "#F5C5AB", "#E19884", "#DB6857", "#C93636"];
  
          const generateRenderer = (thematicField) => {
            let fieldSelect = thematicField || "pd";
  
            const params = {
              layer: featureLayer,
              view: view,
              field: fieldSelect,
              classificationMethod: "natural-breaks",
              numClasses: 5,
              defaultSymbolEnabled: false,
            };
  
            colorRendererCreator.createClassBreaksRenderer(params).then((rendererResponse) => {
              const newRenderer = rendererResponse.renderer;
              newRenderer.backgroundFillSymbol = {
                type: "simple-fill",
                outline: {
                  width: 1,
                  color: "gray",
                },
              };
  
              const breakInfos = newRenderer.classBreakInfos;
  
              // Update labels with descriptive text and format values
              breakInfos[0].label = `Very Low (${formatValue(breakInfos[0].minValue)} - ${formatValue(breakInfos[0].maxValue)})`;
              breakInfos[1].label = `Low (${formatValue(breakInfos[1].minValue)} - ${formatValue(breakInfos[1].maxValue)})`;
              breakInfos[2].label = `Medium (${formatValue(breakInfos[2].minValue)} - ${formatValue(breakInfos[2].maxValue)})`;
              breakInfos[3].label = `High (${formatValue(breakInfos[3].minValue)} - ${formatValue(breakInfos[3].maxValue)})`;
              breakInfos[4].label = `Very High (${formatValue(breakInfos[4].minValue)} - ${formatValue(breakInfos[4].maxValue)})`;
  
              const assignColorToClassBreaksRenderer = (nClass, colorList) => {
                for (let i = 0; i < nClass; i++) {
                  breakInfos[i].symbol.color = colorList[i];
                }
              };
  
              // Assign colors and update legend title based on thematic field
              let legendTitle = "Population Density"; // Default title
              switch (thematicField) {
                default:
                  assignColorToClassBreaksRenderer(breakInfos.length, riskColor);
                  legendTitle = "Population Density";
              }
  
              // Update the legend title dynamically
              const legendNode = document.querySelector(".esri-legend__service-label");
              if (legendNode) {
                legendNode.textContent = legendTitle;
              }
  
              featureLayer.renderer = newRenderer;
            });
          };
  
          // Helper function to format values
          const formatValue = (value) => {
            return value === 0 || value === 1 ? value : value.toFixed(1);
          };
  
        } else {
          this.displayError({
            name: `Can't Find Layer`,
            message: `The layer '${layerTitle}' can't be found in this map.`,
          });
        }
      });
    }
  }

  /**
   * Initialize map action functionality
   */
    initializeMapAction({ view }) {
    if (view) {
      require(["esri/core/reactiveUtils"], (reactiveUtils) => {
        // List the layers you want to support
        const supportedLayerTitles = ["INDEX_INFO", "HOSPITALS_INFO"];
        const supportedLayers = supportedLayerTitles
          .map(title => view.map.allLayers.find(layer => layer.title === title))
          .filter(Boolean);

        // Prepare highlight handles for each layer
        const highlightHandles = {};

        // Wait for all layer views to be ready
        Promise.all(
          supportedLayers.map(layer => view.whenLayerView(layer))
        ).then(layerViews => {
          reactiveUtils.whenOnce(() => layerViews.every(lv => !lv.updating)).then(() => {
            view.on("click", (event) => {
              // Check if the Measurement Tool is active
              const measurementTool = document.querySelector("#toolbarDiv .esri-widget--button.active");
              if (measurementTool) {
                // If the measurement tool is active, prevent feature clicking
                console.log("Measurement tool is active. Feature clicking is disabled.");
                return;
              }

              // Hit test for all supported layers
              view.hitTest(event).then((response) => {
                const graphicHits = response.results?.filter(
                  (hitResult) =>
                    hitResult.type === "graphic" &&
                    supportedLayers.includes(hitResult.graphic.layer)
                );

                if (graphicHits?.length > 0) {
                  const feature = graphicHits[0].graphic;
                  const layer = feature.layer;
                  const layerView = layerViews[supportedLayers.indexOf(layer)];

                  // Remove previous highlight for this layer
                  if (highlightHandles[layer.title]) {
                    highlightHandles[layer.title].remove();
                    highlightHandles[layer.title] = null;
                  }
                  highlightHandles[layer.title] = layerView.highlight(feature);

                  // Handle each layer's logic
                  if (layer.title === "INDEX_INFO") {
                    // Ensure left panel is visible
                    const leftPanel = document.querySelector('calcite-shell-panel[slot="panel-start"]');
                    if (leftPanel && leftPanel.collapsed) leftPanel.collapsed = false;

                    this.updatePolarChart(feature);
                    this.updateDetails(feature, layerView);

                    // Ensure the right panel is visible
                    const rightPanel = document.getElementById("panel-stats-end");
                    if (rightPanel) rightPanel.collapsed = false;
                  } else if (layer.title === "HOSPITALS_INFO") {
                    // Pan and zoom to the hospital feature at zoom level 10
                    view.goTo({
                      target: feature.geometry,
                      zoom: 11
                    }, { animate: true, duration: 1000 });

                    // Query the layer for the full feature attributes using fid/ObjectID
                    const hospitalsLayer = layer;
                    const objectId = feature.getAttribute("OBJECTID") || feature.getAttribute("fid");
                    hospitalsLayer.queryFeatures({
                      objectIds: [objectId],
                      outFields: ["*"],
                      returnGeometry: true
                    }).then((result) => {
                      if (result.features.length > 0) {
                        const fullFeature = result.features[0];
                        const id = fullFeature.getAttribute("fid") || "";
                        const imgPath = `./assets/hospital/${id}.jpg`;

                        const htmlContent = `
                          <h3>${fullFeature.getAttribute("h_center") || ""}</h3>
                          <img src="${imgPath}" alt="Image" style="width:100%;max-width:300px;border-radius:8px;margin-bottom:12px;">
                          <b>Started Year:</b> ${fullFeature.getAttribute("est_year") || "N/A"}<br>
                          <b>Address:</b> ${fullFeature.getAttribute("gewog") || "N/A"}, ${fullFeature.getAttribute("dzongkhag") || "N/A"}<br>
                          <b>Number of beds:</b> ${fullFeature.getAttribute("beds") || "N/A"}<br>
                          <b>Contact Info:</b> ${fullFeature.getAttribute("contact") || "N/A"}<br>
                          <b>Website Info:</b> ${
                            fullFeature.getAttribute("website")
                              ? `<a href="${fullFeature.getAttribute("website")}" target="_blank" rel="noopener">${fullFeature.getAttribute("website")}</a>`
                              : "N/A"
                          }<br>
                        `;

                        // Show your custom popup
                        showHospitalPopup(htmlContent);
                      }
                    }).catch((error) => {
                      console.error("Error querying hospital feature:", error);
                    });
                  }
                } else {
                  // No feature clicked, clear all highlights and panels
                  this.clearPolarChart();
                  const indexLayerView = layerViews[supportedLayerTitles.indexOf("INDEX_INFO")];
                  if (indexLayerView) this.clearDetails(view, indexLayerView);

                  // Collapse the right panel
                  const rightPanel = document.getElementById("panel-stats-end");
                  if (rightPanel) rightPanel.collapsed = true;

                  // Remove all highlights
                  Object.values(highlightHandles).forEach(handle => {
                    if (handle) handle.remove();
                  });
                  Object.keys(highlightHandles).forEach(key => {
                    highlightHandles[key] = null;
                  });

                  // Hide the custom hospital popup if open
                  document.getElementById('hospital-info-popup').style.display = 'none';
                }
              }).catch((error) => {
                console.error("Error during hitTest:", error);
              });
            });
          });
        });
      });
    }
  }
    
  /**
   * Initialize ranking functionality
   */
  initializeRank({view}) {
    if (view) {
      const numberFormatter = new Intl.NumberFormat('en-US');

      // FEATURE LAYER //
      const layerTitle = "INDEX_INFO";
      const featureLayer = view.map.allLayers.find(layer => layer.title === layerTitle);
      if (featureLayer) {
        featureLayer.load().then(() => {
          featureLayer.set({ outFields: ["*"] });
        });
      } else {
        this.displayError({
          name: `Can't Find Layer`,
          message: `The layer '${layerTitle}' can't be found in this map.`,
        });
      }
    }
  }

  /**
   * Application ready handler
   */
  applicationReady({ portal, group, map, view }) {
    return new Promise(async (resolve, reject) => {
      // VIEW READY //
      this.configView({view}).then(() => {
        // Initialize all components
        this.initializePanelState();
        this.initializeUploadData({ portal, map, view });
        this.initializePolarChart();
        this.initializeDisplayDetails({view});
        this.initializeMapDisplay({view});
        this.initializeMapAction({view});
        this.initializeRank({view});

        resolve();
      }).catch(reject);
    });
  }
}



export default new Application();