'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Rename User_Profiles table to UserProfiles
      await queryInterface.renameTable('User_Profiles', 'UserProfiles', {
        transaction,
      });

      // Add new columns to UserProfiles
      await queryInterface.addColumn(
        'UserProfiles',
        'story',
        {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        { transaction }
      );
      await queryInterface.addColumn(
        'UserProfiles',
        'allowPhysicalEvents',
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        { transaction }
      );
      await queryInterface.addColumn(
        'UserProfiles',
        'allowRemoteEvents',
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        { transaction }
      );
      await queryInterface.renameColumn('UserProfiles', 'UserId', 'userId', {
        transaction,
      });

      // BusinessSectors
      await queryInterface.createTable(
        'BusinessSectors',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          name: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          value: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          prefixes: {
            type: Sequelize.STRING,
            allowNull: false,
          },
        },
        { transaction }
      );

      // Occupations
      await queryInterface.createTable(
        'Occupations',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
          },
          name: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          prefix: {
            type: Sequelize.STRING,
            allowNull: false,
          },
        },
        { transaction }
      );

      // UserProfileSectorOccupations
      await queryInterface.createTable(
        'UserProfileSectorOccupations',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          userProfileId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'UserProfiles',
              key: 'id',
            },
          },
          businessSectorId: {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: 'BusinessSectors',
              key: 'id',
            },
          },
          occupationId: {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: 'Occupations',
              key: 'id',
            },
          },
          order: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: -1,
          },
        },
        { transaction }
      );

      // Rename Contracts to OldContracts
      await queryInterface.renameTable('Contracts', 'DeprecatedContracts', {
        transaction,
      });

      // Contracts
      await queryInterface.createTable(
        'Contracts',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          name: {
            type: Sequelize.STRING,
            allowNull: false,
          },
        },
        { transaction }
      );

      // UserProfileContracts
      await queryInterface.createTable(
        'UserProfileContracts',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          userProfileId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'UserProfiles',
              key: 'id',
            },
          },
          contractId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'Contracts',
              key: 'id',
            },
          },
        },
        { transaction }
      );

      // Languages
      await queryInterface.renameTable('Languages', 'DeprecatedLanguages', {
        transaction,
      });
      await queryInterface.createTable(
        'Languages',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          value: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          name: {
            type: Sequelize.STRING,
            allowNull: false,
          },
        },
        { transaction }
      );

      // UserProfileLanguages
      await queryInterface.createTable(
        'UserProfileLanguages',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          userProfileId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'UserProfiles',
              key: 'id',
            },
          },
          languageId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'Languages',
              key: 'id',
            },
          },
          level: {
            type: Sequelize.STRING,
            allowNull: true,
          },
        },
        { transaction }
      );

      // Departments
      await queryInterface.createTable(
        'Departments',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          value: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          name: {
            type: Sequelize.STRING,
            allowNull: false,
          },
        },
        { transaction }
      );

      // UserProfileDepartments
      await queryInterface.createTable(
        'UserProfileDepartments',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          userProfileId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'UserProfiles',
              key: 'id',
            },
          },
          departmentId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'Departments',
              key: 'id',
            },
          },
        },
        { transaction }
      );

      // Interests
      await queryInterface.createTable(
        'Interests',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
          },
          name: {
            type: Sequelize.STRING,
            allowNull: false,
          },
        },
        { transaction }
      );

      // UserProfileInterests
      await queryInterface.createTable(
        'UserProfileInterests',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          userProfileId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'UserProfiles',
              key: 'id',
            },
          },
          interestId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'Interests',
              key: 'id',
            },
          },
        },
        { transaction }
      );

      // Skills
      await queryInterface.renameTable('Skills', 'DeprecatedSkills', {
        transaction,
      });
      await queryInterface.createTable(
        'Skills',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          name: {
            type: Sequelize.STRING,
            allowNull: false,
          },
        },
        { transaction }
      );
      await queryInterface.createTable(
        'UserProfileSkills',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          userProfileId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'UserProfiles',
              key: 'id',
            },
          },
          skillId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'Skills',
              key: 'id',
            },
          },
          order: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: -1,
          },
        },
        { transaction }
      );

      // Experiences
      await queryInterface.renameTable('Experiences', 'DeprecatedExperiences', {
        transaction,
      });
      await queryInterface.createTable(
        'Experiences',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          title: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: false,
          },
          company: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          location: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          startDate: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          endDate: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        },
        { transaction }
      );
      await queryInterface.renameTable(
        'Experience_Skills',
        'DeprecatedExperience_Skills',
        { transaction }
      );
      await queryInterface.createTable(
        'ExperienceSkills',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          experienceId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'Experiences',
              key: 'id',
            },
          },
          skillId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'Skills',
              key: 'id',
            },
          },
          order: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: -1,
          },
        },
        { transaction }
      );
      await queryInterface.createTable(
        'UserProfileExperiences',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          userProfileId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'UserProfiles',
              key: 'id',
            },
          },
          experienceId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'Experiences',
              key: 'id',
            },
          },
        },
        { transaction }
      );

      // Formations
      await queryInterface.renameTable('Formations', 'DeprecatedFormations', {
        transaction,
      });
      await queryInterface.createTable(
        'Formations',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          title: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: false,
          },
          institution: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          location: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          startDate: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          endDate: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        },
        { transaction }
      );
      await queryInterface.renameTable(
        'Formation_Skills',
        'DeprecatedFormation_Skills',
        { transaction }
      );
      await queryInterface.createTable(
        'FormationSkills',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          formationId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'Formations',
              key: 'id',
            },
          },
          skillId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'Skills',
              key: 'id',
            },
          },
        },
        { transaction }
      );
      await queryInterface.createTable(
        'UserProfileFormations',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          userProfileId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'UserProfiles',
              key: 'id',
            },
          },
          formationId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'Formations',
              key: 'id',
            },
          },
        },
        { transaction }
      );

      // Reviews
      await queryInterface.renameTable('Reviews', 'DeprecatedReviews', {
        transaction,
      });
      await queryInterface.createTable(
        'Reviews',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
          },
          userProfileId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'UserProfiles',
              key: 'id',
            },
          },
          authorName: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          authorLabel: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          content: {
            type: Sequelize.TEXT,
            allowNull: false,
          },
        },
        { transaction }
      );

      // Requests
      await queryInterface.createTable(
        'RequestTypes',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
          },
          name: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          order: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: -1,
          },
        },
        { transaction }
      );

      await queryInterface.createTable(
        'Requests',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          },
          content: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          requestTypeId: {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: 'RequestTypes',
              key: 'id',
            },
          },
          userProfileId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'UserProfiles',
              key: 'id',
            },
          },
        },
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Requests
      await queryInterface.dropTable('Requests', { transaction });
      await queryInterface.dropTable('RequestTypes', { transaction });

      // Reviews
      await queryInterface.dropTable('Reviews', { transaction });
      await queryInterface.renameTable('DeprecatedReviews', 'Reviews', {
        transaction,
      });

      // Formation Skills
      await queryInterface.dropTable('FormationSkills', { transaction });
      await queryInterface.renameTable(
        'DeprecatedFormation_Skills',
        'Formation_Skills',
        { transaction }
      );

      // Formations
      await queryInterface.dropTable('Formations', { transaction });
      await queryInterface.renameTable('DeprecatedFormations', 'Formations', {
        transaction,
      });

      // UserProfile Experiences
      await queryInterface.dropTable('UserProfileExperiences', { transaction });

      // Experience Skills
      await queryInterface.dropTable('ExperienceSkills', { transaction });
      await queryInterface.renameTable(
        'DeprecatedExperience_Skills',
        'Experience_Skills',
        { transaction }
      );

      // Experiences
      await queryInterface.dropTable('Experiences', { transaction });
      await queryInterface.renameTable('DeprecatedExperiences', 'Experiences', {
        transaction,
      });

      // Skills
      await queryInterface.dropTable('UserProfileSkills', { transaction });
      await queryInterface.dropTable('Skills', { transaction });
      await queryInterface.renameTable('DeprecatedSkills', 'Skills', {
        transaction,
      });

      // Interests
      await queryInterface.dropTable('UserProfileInterests', { transaction });
      await queryInterface.dropTable('Interests', { transaction });

      // Departments
      await queryInterface.dropTable('UserProfileDepartments', { transaction });
      await queryInterface.dropTable('Departments', { transaction });

      // Languages
      await queryInterface.dropTable('UserProfileLanguages', { transaction });
      await queryInterface.dropTable('Languages', { transaction });
      await queryInterface.renameTable('DeprecatedLanguages', 'Languages', {
        transaction,
      });

      // Contracts
      await queryInterface.dropTable('UserProfileContracts', { transaction });
      await queryInterface.dropTable('Contracts', { transaction });
      await queryInterface.renameTable('DeprecatedContracts', 'Contracts', {
        transaction,
      });

      // BusinessSectors & Occupations
      await queryInterface.dropTable('UserProfileSectorOccupations', {
        transaction,
      });
      await queryInterface.dropTable('Occupations', { transaction });
      await queryInterface.dropTable('BusinessSectors', { transaction });

      // UserProfiles
      await queryInterface.renameColumn('UserProfiles', 'userId', 'UserId', {
        transaction,
      });
      await queryInterface.removeColumn('UserProfiles', 'story', {
        transaction,
      });
      await queryInterface.removeColumn('UserProfiles', 'allowRemoteEvents', {
        transaction,
      });
      await queryInterface.removeColumn('UserProfiles', 'allowPhysicalEvents', {
        transaction,
      });
      await queryInterface.renameTable('UserProfiles', 'User_Profiles', {
        transaction,
      });
      // Commit de la transaction
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
