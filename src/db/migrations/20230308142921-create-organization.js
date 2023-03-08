const uuid = require('uuid');

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.createTable('Organizations', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return uuid.v4();
        },
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      address: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      referentFirstName: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      referentLastName: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      referentMail: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      referentPhone: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      zone: {
        allowNull: false,
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
  down(queryInterface) {
    return queryInterface.dropTable('Organizations');
  },
};
