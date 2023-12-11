const { QueryTypes } = require('sequelize');
const uuid = require('uuid');
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('User_Profiles', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
      },
      UserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      description: {
        allowNull: true,
        type: Sequelize.TEXT,
      },
      currentJob: {
        allowNull: true,
        type: Sequelize.TEXT,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      deletedAt: {
        allowNull: true,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.createTable('Help_Needs', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
      },
      UserProfileId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'User_Profiles',
          key: 'id',
        },
      },
      name: {
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
    await queryInterface.createTable('Help_Offers', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
      },
      UserProfileId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'User_Profiles',
          key: 'id',
        },
      },
      name: {
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
    await queryInterface.createTable('User_Profile_Network_BusinessLines', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
      },
      UserProfileId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'User_Profiles',
          key: 'id',
        },
      },
      BusinessLineId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'BusinessLines',
          key: 'id',
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
    });
    await queryInterface.createTable('User_Profile_Search_BusinessLines', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
      },
      UserProfileId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'User_Profiles',
          key: 'id',
        },
      },
      BusinessLineId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'BusinessLines',
          key: 'id',
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
    });
    await queryInterface.createTable('User_Profile_Search_Ambitions', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
      },
      UserProfileId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'User_Profiles',
          key: 'id',
        },
      },
      AmbitionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Ambitions',
          key: 'id',
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
    });

    const usersIds = await queryInterface.sequelize.query(
      'SELECT id FROM "Users"',
      { type: QueryTypes.SELECT }
    );

    const userProfiles = usersIds.map(({ id }) => {
      return {
        id: uuid.v4(),
        UserId: id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    if (userProfiles?.length > 0) {
      await queryInterface.bulkInsert('User_Profiles', userProfiles);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('User_Profile_Network_BusinessLines');
    await queryInterface.dropTable('User_Profile_Search_BusinessLines');
    await queryInterface.dropTable('User_Profile_Search_Ambitions');
    await queryInterface.dropTable('Help_Needs');
    await queryInterface.dropTable('Help_Offers');
    await queryInterface.dropTable('User_Profiles');
  },
};
