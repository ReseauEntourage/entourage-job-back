module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('CV_BusinessLines', {
      CVId: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'CVs',
          key: 'id',
        },
        onDelete: 'cascade',
        onUpdate: 'cascade',
      },
      BusinessLineId: {
        type: Sequelize.UUID,
        primaryKey: true,
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
    return queryInterface.dropTable('CV_BusinessLines');
  },
};
