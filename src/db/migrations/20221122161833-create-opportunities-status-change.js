const uuid = require('uuid');

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.createTable('OpportunityUser_StatusChange', {
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
          Opportunity_UserId: {
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
          return queryInterface.addColumn('Opportunity_Users', 'opportunityUserStatusChange', {
            type: Sequelize.UUID,
            primaryKey: true,
            allowNull: true,
            references: {
              model: 'OpportunityUser_StatusChange',
              key: 'id',
            },
            onDelete: 'cascade',
            onUpdate: 'cascade',
          })
        })

  },
  async down(queryInterface) {
    await queryInterface.dropTable('OpportunityUser_StatusChange');
  }
};