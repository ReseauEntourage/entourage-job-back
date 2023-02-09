const uuid = require('uuid');

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.createTable('OpportunityUser_Events', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return uuid.v4();
        },
      },
      OpportunityUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Opportunity_Users',
          key: 'id',
        },
      },
      ContractId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Contracts',
          key: 'id',
        },
      },
      type: {
        type: Sequelize.STRING,
      },
      startDate: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      endDate: {
        allowNull: true,
        type: Sequelize.DATE,
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
  down(queryInterface) {
    return queryInterface.dropTable('OpportunityUser_Events');
  },
};
