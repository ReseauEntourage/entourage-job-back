module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.renameColumn('Users', 'hiden', 'hidden'),
      queryInterface.removeColumn('CVs', 'url'),
      queryInterface.removeColumn('CVs', 'visibility'),
      queryInterface.addColumn('Opportunity_Users', 'adminValidated', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      }),
      queryInterface.removeColumn('Opportunities', 'category'),
      queryInterface.addColumn('Opportunities', 'isPublic', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      }),
      // queryInterface.addColumn('Users', 'verified', {
      //   type: Sequelize.BOOLEAN,
      //   defaultValue: false,
      //   allowNull: false,
      // }),
      queryInterface.addColumn('Users', 'lastConnection', Sequelize.DATE),
    ]);
  },
  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.renameColumn('Users', 'hidden', 'hiden'),
      queryInterface.addColumn('CVs', 'url', {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: 'to-define',
      }),
      queryInterface.addColumn('CVs', 'visibility', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      }),
      queryInterface.removeColumn('Opportunity_Users', 'adminValidated'),
      queryInterface.addColumn('Opportunities', 'category', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Public',
      }),
      queryInterface.removeColumn('Opportunities', 'isPublic'),
      // queryInterface.removeColumn('Users', 'verified'),
      queryInterface.removeColumn('Users', 'lastConnection'),
    ]);
  },
};
