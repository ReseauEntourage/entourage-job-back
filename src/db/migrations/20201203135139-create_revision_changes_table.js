import uuid from 'uuid/v4';

export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('RevisionChanges', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return uuid();
        },
      },
      path: {
        type: Sequelize.TEXT,
      },
      document: {
        type: Sequelize.JSONB,
      },
      diff: {
        type: Sequelize.JSONB,
      },
      revisionId: {
        type: Sequelize.UUID,
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
    return queryInterface.dropTable('RevisionChanges');
  },
};
