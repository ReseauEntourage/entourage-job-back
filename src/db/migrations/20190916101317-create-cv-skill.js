const { randomUUID } = require('crypto');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('CV_Skills', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return randomUUID();
        },
      },
      CVid: {
        allowNull: false,
        references: {
          model: 'CVs',
          key: 'id',
        },
        type: Sequelize.UUID,
      },
      name: {
        type: Sequelize.STRING,
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
    return queryInterface.dropTable('CV_Skills');
  },
};
