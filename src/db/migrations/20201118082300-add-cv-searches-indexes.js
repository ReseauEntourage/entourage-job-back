export default {
  up: (queryInterface) => {
    return Promise.all([
      queryInterface.addIndex('CV_Searches', ['CVId', 'searchString']),
    ]);
  },

  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeIndex('CV_Searches', ['CVId', 'searchString']),
    ]);
  },
};
