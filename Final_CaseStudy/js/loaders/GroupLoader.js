class GroupLoader {

  /**
   * @type {Portal}
   */
  portal;

  /**
   * @type {string}
   */
  groupId;

  /**
   * @type {PortalGroup}
   *
   */
  group;

  /**
   *
   * @param config
   * @param portal
   */
  constructor(config, portal) {

    // GROUP ID //
    this.groupId = config.group;

    // PORTAL //
    this.portal = portal;

  }

  /**
   *
   * @returns {Promise<PortalGroup>}
   */
  loadGroup() {
    return new Promise((resolve, reject) => {
      if (this.groupId) {

        this.portal.queryGroups({query: `(id:${ this.groupId })`, num: 1}).then(queryResponse => {
          if (queryResponse.results.length) {
            this.group = queryResponse.results[0];
            resolve(this.group);
          } else {
            console.error(new Error("Can't find configured group."));
          }
        });

      } else {
        reject(new Error('No configured Group id.'));
      }
    });
  }

}

GroupLoader.hasGroup = (config) => {
  return ((config.group != null) && config.group.length);
};

export default GroupLoader;
