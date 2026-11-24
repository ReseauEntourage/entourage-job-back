const { randomUUID } = require('crypto');

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.createTable('OpportunityUser_StatusChanges', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return randomUUID();
        },
      },
      oldStatus: {
        type: Sequelize.INTEGER,
      },
      newStatus: {
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
      OpportunityUserId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      UserId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      OpportunityId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('OpportunityUser_StatusChanges');
  },
};
