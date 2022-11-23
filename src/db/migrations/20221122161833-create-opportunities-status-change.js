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
        primaryKey: true,
        allowNull: false,
        references: {
          model: 'Opportunity_User',
          key: 'id',
        },
        onDelete: 'cascade',
        onUpdate: 'cascade',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('OpportunityUser_StatusChange');
  }
};