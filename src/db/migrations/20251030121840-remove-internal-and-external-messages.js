'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.dropTable('InternalMessages');
    await queryInterface.dropTable('ExternalMessages');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('InternalMessages', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      addresseeUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      senderUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      subject: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable('ExternalMessages', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      senderFirstName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      senderLastName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      senderEmail: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      senderPhone: {
        type: Sequelize.STRING(255),
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      UserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      subject: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING(255),
      },
      optInNewsletter: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    });
  },
};
