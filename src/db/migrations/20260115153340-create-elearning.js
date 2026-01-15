'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ElearningUnits', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
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
      title: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      description: {
        allowNull: true,
        type: Sequelize.TEXT,
      },
      videoUrl: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      durationMinutes: {
        allowNull: true,
        type: Sequelize.INTEGER,
      },
    });

    // Table de liaison entre ElearningUnits et rôles utilisateurs
    await queryInterface.createTable('ElearningUnitRoles', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      elearningUnitId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'ElearningUnits',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      role: {
        allowNull: false,
        type: Sequelize.STRING,
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
    });

    await queryInterface.createTable('ElearningQuestions', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
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
      unitId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'ElearningUnits',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      label: {
        allowNull: false,
        type: Sequelize.TEXT,
      },
      order: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
    });

    await queryInterface.createTable('ElearningAnswers', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
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
      questionId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'ElearningQuestions',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      label: {
        allowNull: false,
        type: Sequelize.TEXT,
      },
      isCorrect: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
    });

    await queryInterface.createTable('ElearningCompletions', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
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
      userId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      unitId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'ElearningUnits',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      validatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addConstraint('ElearningCompletions', {
      fields: ['userId', 'unitId'],
      type: 'unique',
      name: 'unique_elearning_completion_per_user_per_unit',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ElearningCompletions');
    await queryInterface.dropTable('ElearningAnswers');
    await queryInterface.dropTable('ElearningQuestions');
    await queryInterface.dropTable('ElearningUnitRoles');
    await queryInterface.dropTable('ElearningUnits');
  },
};
