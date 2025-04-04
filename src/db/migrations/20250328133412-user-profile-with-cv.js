'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Rename User_Profiles table to UserProfiles
    await queryInterface.renameTable('User_Profiles', 'UserProfiles');

    // Add new columns to UserProfiles
    await queryInterface.addColumn('UserProfiles', 'story', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('UserProfiles', 'allowPhysicalEvents', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn('UserProfiles', 'allowRemoteEvents', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.renameColumn('UserProfiles', 'UserId', 'userId');

    // BusinessSectors
    await queryInterface.createTable('BusinessSectors', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
        },
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
    });

    // UserProfileBusinessSectors
    await queryInterface.createTable('UserProfileBusinessSectors', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
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
      businessSectorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'BusinessSectors',
          key: 'id',
        },
      },
    });

    // Occupations
    await queryInterface.createTable('Occupations', {
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
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      prefix: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    });

    // UserProfileOccupations
    await queryInterface.createTable('UserProfileOccupations', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
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
      occupationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Occupations',
          key: 'id',
        },
      },
    });

    // Rename Contracts to OldContracts
    await queryInterface.renameTable('Contracts', 'DeprecatedContracts');

    // Contracts
    await queryInterface.createTable('Contracts', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
        },
      },
      value: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    });

    // UserProfileContracts
    await queryInterface.createTable('UserProfileContracts', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
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
      contractId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Contracts',
          key: 'id',
        },
      },
    });

    // Languages
    await queryInterface.renameTable('Languages', 'DeprecatedLanguages');
    await queryInterface.createTable('Languages', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
        },
      },
      value: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    });

    // UserProfileLanguages
    await queryInterface.createTable('UserProfileLanguages', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
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
    });

    // Departments
    await queryInterface.createTable('Departments', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
        },
      },
      value: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    });

    // UserProfileDepartments
    await queryInterface.createTable('UserProfileDepartments', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
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
      departmentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Departments',
          key: 'id',
        },
      },
    });

    // Interests
    await queryInterface.createTable('Interests', {
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
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    });

    // UserProfileInterests
    await queryInterface.createTable('UserProfileInterests', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
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
      interestId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Interests',
          key: 'id',
        },
      },
    });

    // Skills
    await queryInterface.renameTable('Skills', 'DeprecatedSkills');
    await queryInterface.createTable('Skills', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
        },
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
    });

    // Experiences
    await queryInterface.renameTable('Experiences', 'DeprecatedExperiences');
    await queryInterface.createTable('Experiences', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
        },
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
    });
    await queryInterface.renameTable(
      'Experience_Skills',
      'DeprecatedExperience_Skills'
    );
    await queryInterface.createTable('ExperienceSkills', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
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
      skillId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Skills',
          key: 'id',
        },
      },
    });

    // Formations
    await queryInterface.renameTable('Formations', 'DeprecatedFormations');
    await queryInterface.createTable('Formations', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
        },
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
    });
    await queryInterface.renameTable(
      'Formation_Skills',
      'DeprecatedFormation_Skills'
    );
    await queryInterface.createTable('FormationSkills', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
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
      skillId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Skills',
          key: 'id',
        },
      },
    });

    // Reviews
    await queryInterface.renameTable('Reviews', 'DeprecatedReviews');
    await queryInterface.createTable('Reviews', {
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
    });

    // Requests
    await queryInterface.createTable('RequestTypes', {
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
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: -1,
      },
    });

    await queryInterface.createTable('Requests', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: () => {
          return UUID.v4();
        },
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
    });
  },

  async down(queryInterface, Sequelize) {
    // Requests
    await queryInterface.dropTable('Requests');
    await queryInterface.dropTable('RequestTypes');

    // Reviews
    await queryInterface.dropTable('Reviews');
    await queryInterface.renameTable('DeprecatedReviews', 'Reviews');

    // Formation Skills
    await queryInterface.dropTable('FormationSkills');
    await queryInterface.renameTable(
      'DeprecatedFormation_Skills',
      'Formation_Skills'
    );

    // Formations
    await queryInterface.dropTable('Formations');
    await queryInterface.renameTable('DeprecatedFormations', 'Formations');

    // Experience Skills
    await queryInterface.dropTable('ExperienceSkills');
    await queryInterface.renameTable(
      'DeprecatedExperience_Skills',
      'Experience_Skills'
    );

    // Experiences
    await queryInterface.dropTable('Experiences');
    await queryInterface.renameTable('DeprecatedExperiences', 'Experiences');

    // Skills
    await queryInterface.dropTable('Skills');
    await queryInterface.renameTable('DeprecatedSkills', 'Skills');

    // Interests
    await queryInterface.dropTable('UserProfileInterests');
    await queryInterface.dropTable('Interests');

    // Departments
    await queryInterface.dropTable('UserProfileDepartments');
    await queryInterface.dropTable('Departments');

    // Languages
    await queryInterface.dropTable('UserProfileLanguages');
    await queryInterface.dropTable('Languages');
    await queryInterface.renameTable('DeprecatedLanguages', 'Languages');

    // Contracts
    await queryInterface.dropTable('UserProfileContracts');
    await queryInterface.dropTable('Contracts');
    await queryInterface.renameTable('DeprecatedContracts', 'Contracts');

    // Occupations
    await queryInterface.dropTable('UserProfileOccupations');
    await queryInterface.dropTable('Occupations');

    // BusinessSectors
    await queryInterface.dropTable('UserProfileBusinessSectors');
    await queryInterface.dropTable('BusinessSectors');

    // UserProfiles
    await queryInterface.renameColumn('UserProfiles', 'userId', 'UserId');
    await queryInterface.removeColumn('UserProfiles', 'story');
    await queryInterface.removeColumn('UserProfiles', 'allowRemoteEvents');
    await queryInterface.removeColumn('UserProfiles', 'allowPhysicalEvents');
    await queryInterface.renameTable('UserProfiles', 'User_Profiles');
  },
};
