const { randomUUID } = require('crypto');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Shares', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return randomUUID();
        },
      },
      CandidatId: {
        allowNull: false,
        type: Sequelize.UUID,
        unique: true,
      },
      facebook: {
        allowNull: false,
        defaultValue: 0,
        type: Sequelize.INTEGER,
      },
      linkedin: {
        allowNull: false,
        defaultValue: 0,
        type: Sequelize.INTEGER,
      },
      twitter: {
        allowNull: false,
        defaultValue: 0,
        type: Sequelize.INTEGER,
      },
      whatsapp: {
        allowNull: false,
        defaultValue: 0,
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
    });
  },
  down: (queryInterface) => {
    return queryInterface.dropTable('Shares');
  },
};
