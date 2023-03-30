module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.createTable('Organizations', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      address: {
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
    }).then(() => {
      queryInterface.createTable('Organization_Referents', {
        id: {
          allowNull: false,
          primaryKey: true,
          type: Sequelize.UUID,
        },
        OrganizationId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Organizations',
            key: 'id',
          },
        },
        UserId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
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
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
      })
    });
  },
  down(queryInterface) {
    return queryInterface.dropTable('Organization_Referents').then(() => {
      return queryInterface.dropTable('Organizations')
    });
  },
};
