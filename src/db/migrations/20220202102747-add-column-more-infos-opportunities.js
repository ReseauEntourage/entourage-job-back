export default {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.renameColumn('Opportunities', 'location', 'address'),
      queryInterface.addColumn('Opportunities', 'driversLicense', {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }),
      queryInterface.addColumn('Opportunities', 'workingHours', {
        allowNull: true,
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('Opportunities', 'salary', {
        allowNull: true,
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('Opportunities', 'otherInfo', {
        allowNull: true,
        type: Sequelize.TEXT,
      }),
    ]);
  },
  down: (queryInterface) => {
    return Promise.all([
      queryInterface.renameColumn('Opportunities', 'address', 'location'),
      queryInterface.removeColumn('Opportunities', 'driversLicense'),
      queryInterface.removeColumn('Opportunities', 'workingHours'),
      queryInterface.removeColumn('Opportunities', 'salary'),
      queryInterface.removeColumn('Opportunities', 'otherInfo'),
    ]);
  },
};
