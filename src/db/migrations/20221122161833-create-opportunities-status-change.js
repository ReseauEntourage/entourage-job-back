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
            type: Sequelize.INTEGER
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
        .then(() => {
          return queryInterface.addColumn('Opportunity_Users', 'opportunityUserStatusChanges', {
            type: Sequelize.UUID,
            primaryKey: true,
            allowNull: true,
            references: {
              model: 'OpportunityUser_StatusChanges',
              key: 'id',
            },
            onDelete: 'cascade',
            onUpdate: 'cascade',
          })
        })

  },
  async down(queryInterface) {
    await queryInterface.dropTable('OpportunityUser_StatusChanges');
  }
};