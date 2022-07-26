export default {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('User_Candidats', 'contract', {
        allowNull: true,
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('User_Candidats', 'endOfContract', {
        allowNull: true,
        type: Sequelize.DATEONLY,
      }),
    ]);
  },
  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeColumn('User_Candidats', 'contract'),
      queryInterface.removeColumn('User_Candidats', 'endOfContract'),
    ]);
  },
};
