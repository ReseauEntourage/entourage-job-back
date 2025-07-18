'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable('Companies', {
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
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      description: {
        allowNull: true,
        type: Sequelize.TEXT,
      },
      businessSectorId: {
        allowNull: true,
        type: Sequelize.UUID,
        references: {
          model: 'BusinessSectors',
          key: 'id',
        },
      },
      city: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      url: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      hiringUrl: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      linkedInUrl: {
        allowNull: true,
        type: Sequelize.STRING,
      },
    });

    // Create a table for link between users and companies
    await queryInterface.createTable('CompanyUsers', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
        },
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
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      role: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: 'employee',
      },
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('CompanyUsers');
    await queryInterface.dropTable('Companies');
  },
};
