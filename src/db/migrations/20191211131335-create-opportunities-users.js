module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Opportunity_Users', {
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
      UserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'cascade',
        onUpdate: 'cascade',
      },
      status: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      seen: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      bookmarked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      archived: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
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
    return queryInterface.dropTable('Opportunity_Users');
  },
};
