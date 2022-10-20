module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('CVs', 'availability', {
      allowNull: true,
      type: Sequelize.STRING,
    });
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('CVs', 'availability');
  },
};
