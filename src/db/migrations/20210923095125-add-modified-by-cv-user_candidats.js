export default {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('CVs', 'lastModifiedBy', {
        allowNull: true,
        type: Sequelize.UUID,
      }),
      queryInterface.addColumn('User_Candidats', 'lastModifiedBy', {
        allowNull: true,
        type: Sequelize.UUID,
      }),
    ]);
  },
  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeColumn('CVs', 'lastModifiedBy'),
      queryInterface.removeColumn('User_Candidats', 'lastModifiedBy'),
    ]);
  },
};
