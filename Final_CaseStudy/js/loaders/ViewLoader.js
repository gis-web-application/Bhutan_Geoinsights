class ViewLoader {

  // VIEW PROPERTIES //
  _viewProperties;

  constructor(viewProperties) {
    this._viewProperties = viewProperties;
  }

  loadView() {
    return new Promise((resolve, reject) => {

      const {map} = this._viewProperties;

      if (map.declaredClass === 'esri.WebMap') {
        require(['esri/views/MapView'], (MapView) => {
          const mapView = new MapView(this._viewProperties);
          mapView.when(resolve, reject);
        });
      }

      if (map.declaredClass === 'esri.WebScene') {
        require(['esri/views/SceneView'], (SceneView) => {
          const sceneView = new SceneView(this._viewProperties);
          sceneView.when(resolve, reject);
        });
      }

    });
  }

}

export default ViewLoader;
