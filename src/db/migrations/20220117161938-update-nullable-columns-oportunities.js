export default {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn('Opportunities', 'recruiterName', {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.changeColumn('Opportunities', 'recruiterMail', {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.changeColumn('Opportunities', 'description', {
        type: Sequelize.TEXT,
        allowNull: true,
      }),
    ]);
  },
  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.changeColumn('Opportunities', 'recruiterName', {
        type: Sequelize.STRING,
        allowNull: false,
      }),
      queryInterface.changeColumn('Opportunities', 'recruiterMail', {
        type: Sequelize.STRING,
        allowNull: false,
      }),
      queryInterface.changeColumn('Opportunities', 'description', {
        type: Sequelize.TEXT,
        allowNull: false,
      }),
    ]);
  },
};
