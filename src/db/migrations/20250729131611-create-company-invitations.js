'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CompanyInvitations', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
        },
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      email: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      companyId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Companies',
          key: 'id',
        },
      },
      userId: {
        allowNull: true,
        type: Sequelize.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      authorId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('CompanyInvitations');
  },
};
