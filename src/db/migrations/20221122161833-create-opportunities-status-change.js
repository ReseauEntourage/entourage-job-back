const uuid = require('uuid');

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.createTable('OpportunityUser_StatusChanges', {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: () => {
              return uuid.v4();
            },
          },
          oldStatus: {
            type: Sequelize.INTEGER
          },
          newStatus: {
            allowNull: false,
            type: Sequelize.INTEGER
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
            allowNull: false,
            references: {
              model: 'Opportunity_Users',
              key: 'id',
            },
            onDelete: 'cascade',
            onUpdate: 'cascade',
          },
        })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('OpportunityUser_StatusChanges');
  }
};