module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Experiences', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      CVId: {
        allowNull: false,
        type: Sequelize.UUID,
      },
      dateStart: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      dateEnd: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      title: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      description: {
        type: Sequelize.TEXT,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  down: (queryInterface) => {
    return queryInterface.dropTable('Experiences');
  },
};
