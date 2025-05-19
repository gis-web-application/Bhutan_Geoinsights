export const uploadData = (portal, map, view, file) => {
  return new Promise((resolve, reject) => {
    require([
      'esri/request',
      'esri/layers/FeatureLayer',
      'esri/layers/support/Field',
      'esri/Graphic'
    ], (request, FeatureLayer, Field, Graphic) => {
      const portalUrl = portal.url;
      
      const params = {
        name: file.name.split(".")[0],
        targetSR: view.spatialReference,
        maxRecordCount: 1000,
        enforceInputFileSizeLimit: true,
        enforceOutputJsonSizeLimit: true,
        generalize: true,
        maxAllowableOffset: 10,
        reducePrecision: true,
        numberOfDigitsAfterDecimal: 0,
      };

      const formData = new FormData();
      formData.append('file', file);
      formData.append('filetype', "shapefile");
      formData.append('publishParameters', JSON.stringify(params));
      formData.append('f', "json");

      request(portalUrl + "/sharing/rest/content/features/generate", {
        method: "post",
        body: formData,
        responseType: "json"
      })
      .then((response) => {
        if (response.data.error) {
          throw response.data.error;
        }

        if (!response.data.featureCollection?.layers?.length) {
          throw new Error('No valid layers found in the uploaded file');
        }

        const layerName = response.data.featureCollection.layers[0].layerDefinition.name;
        
        // Process the feature collection
        let sourceGraphics = [];
        const layers = response.data.featureCollection.layers.map((layer) => {
          const graphics = layer.featureSet.features.map((feature) => {
            return Graphic.fromJSON(feature);
          });
          sourceGraphics = sourceGraphics.concat(graphics);
          
          return new FeatureLayer({
            title: `Uploaded: ${layer.layerDefinition.name}`,
            objectIdField: layer.layerDefinition.objectIdField || "FID",
            source: graphics,
            fields: layer.layerDefinition.fields.map((field) => {
              return Field.fromJSON(field);
            })
          });
        });

        // Add layers to map
        map.addMany(layers);
        
        // Zoom to features
        view.goTo(sourceGraphics).catch((error) => {
          if (error.name !== "AbortError") {
            console.warn('Could not zoom to features:', error);
          }
        });

        resolve({ layers });
      })
      .catch((error) => {
        reject(new Error(`Failed to process upload: ${error.message}`));
      });
    });
  });
};