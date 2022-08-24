const uuid = require('uuid');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Revisions', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return uuid.v4();
        },
      },
      model: {
        type: Sequelize.TEXT,
      },
      document: {
        type: Sequelize.JSONB,
      },
      operation: {
        type: Sequelize.STRING,
      },
      documentId: {
        type: Sequelize.UUID,
      },
      revision: {
        type: Sequelize.INTEGER,
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
    return queryInterface.dropTable('Revisions');
  },
};
