module.exports = {
  up: (queryInterface, Sequelize) => {
    return  queryInterface.changeColumn('Organizations', 'address', {
        type: Sequelize.STRING,
        allowNull: true,
      })
  },
  down: (queryInterface, Sequelize) => {
    return  queryInterface.changeColumn('Organizations', 'address', {
      type: Sequelize.STRING,
      allowNull: false,
    })
  },
};
