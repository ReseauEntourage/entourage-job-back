module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Messages', 'job');
    await queryInterface.removeColumn('Messages', 'businessLine');
    await queryInterface.removeColumn('Messages', 'company');
    await queryInterface.removeColumn('Messages', 'localization');

    await queryInterface.changeColumn('Messages', 'phone', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('Messages', 'UserId', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
    });
    await queryInterface.addColumn('Messages', 'subject', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.addColumn('Messages', 'type', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Messages', 'job', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Messages', 'businessLine', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Messages', 'company', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Messages', 'localization', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn('Messages', 'phone', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.removeColumn('Messages', 'UserId');
    await queryInterface.removeColumn('Messages', 'subject');
    await queryInterface.removeColumn('Messages', 'type');
  },
};
