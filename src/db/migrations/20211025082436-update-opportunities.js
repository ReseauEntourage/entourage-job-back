export default {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('Opportunities', 'recruiterFirstName', {
        allowNull: true,
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('Opportunities', 'recruiterPosition', {
        allowNull: true,
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('Opportunities', 'companyDescription', {
        allowNull: true,
        type: Sequelize.TEXT,
      }),
      queryInterface.addColumn('Opportunities', 'skills', {
        allowNull: true,
        type: Sequelize.TEXT,
      }),
      queryInterface.addColumn('Opportunities', 'contract', {
        allowNull: true,
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('Opportunities', 'isPartTime', {
        defaultValue: false,
        type: Sequelize.BOOLEAN,
      }),
      queryInterface.addColumn('Opportunities', 'numberOfPositions', {
        allowNull: false,
        defaultValue: 1,
        type: Sequelize.INTEGER,
      }),
      queryInterface.addColumn('Opportunities', 'beContacted', {
        allowNull: false,
        defaultValue: false,
        type: Sequelize.BOOLEAN,
      }),
      queryInterface.addColumn('Opportunities', 'endOfContract', {
        allowNull: true,
        type: Sequelize.DATEONLY,
      }),
      queryInterface.sequelize
        .query('UPDATE "Opportunities" SET date=NOW() WHERE date IS NULL')
        .then(() => {
          queryInterface.changeColumn('Opportunities', 'date', {
            defaultValue: Sequelize.NOW,
            allowNull: false,
            type: Sequelize.DATE,
          });
        }),
    ]);
  },
  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('Opportunities', 'recruiterFirstName'),
      queryInterface.removeColumn('Opportunities', 'recruiterPosition'),
      queryInterface.removeColumn('Opportunities', 'companyDescription'),
      queryInterface.removeColumn('Opportunities', 'skills'),
      queryInterface.removeColumn('Opportunities', 'contract'),
      queryInterface.removeColumn('Opportunities', 'isPartTime'),
      queryInterface.removeColumn('Opportunities', 'endOfContract'),
      queryInterface.removeColumn('Opportunities', 'numberOfPositions'),
      queryInterface.removeColumn('Opportunities', 'beContacted'),
      queryInterface.changeColumn('Opportunities', 'date', {
        allowNull: true,
        type: Sequelize.DATE,
      }),
    ]);
  },
};
