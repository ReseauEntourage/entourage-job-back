export default {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Opportunity_BusinessLines', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      OpportunityId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Opportunities',
          key: 'id',
        },
        onDelete: 'cascade',
        onUpdate: 'cascade',
      },
      BusinessLineId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'BusinessLines',
          key: 'id',
        },
        onDelete: 'cascade',
        onUpdate: 'cascade',
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
    return queryInterface.dropTable('Opportunity_BusinessLines');
  },
};
