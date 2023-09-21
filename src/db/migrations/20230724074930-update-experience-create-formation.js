'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('Formations', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      CVId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'CVs',
          key: 'id'
        },
        onDelete: 'cascade',
        onUpdate: 'cascade',
      },
      dateStart: {
        allowNull: true,
        type: Sequelize.DATE,
      },
      dateEnd: {
        allowNull: true,
        type: Sequelize.DATE,
      },
      title: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      description: {
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
      location: {
        allownull: true,
        type: Sequelize.STRING,
      },
      institution: {
        allowNull: true,
        type: Sequelize.STRING,
      },
    })


    await queryInterface.createTable('Formation_Skills', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      FormationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Formations',
          key: 'id',
        },
      },
      SkillId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Skills',
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
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: -1,
      },
    })

    // await queryInterface.addConstraint('Formations', {
    //   fields: ['CVId'],
    //   type: 'foreign key',
    //   name: 'Formations_CVId_fkey',
    //   references: {
    //     table: 'CVs',
    //     field: 'id',
    //   },
    //   onDelete: 'cascade',
    //   onUpdate: 'cascade',
    // });
    

    await queryInterface.addColumn('Experiences', 'location',
     {
        allownull: true,
        type: Sequelize.STRING,
      })

    await queryInterface.addColumn('Experiences', 'company',
    {
       allownull: true,
       type: Sequelize.STRING,
     })

     queryInterface.addColumn('Experiences', 'dateStart', {
      allownull: true,
      type: Sequelize.DATE,
    })
    queryInterface.addColumn('Experiences', 'dateEnd', {
      allownull: true,
      type: Sequelize.DATE,
    })
    queryInterface.addColumn('Experiences', 'title', {
      allownull: true,
      type: Sequelize.STRING,
    })
  },

  async down (queryInterface, Sequelize) {
    
    await queryInterface.dropTable('Formation_Skills');
    await queryInterface.dropTable('Formations');


    await queryInterface.removeColumn('Experiences', 'company');

    await queryInterface.removeColumn('Experiences', 'location');

    await queryInterface.removeColumn('Experiences', 'dateStart');

    await queryInterface.removeColumn('Experiences', 'dateEnd');

    await queryInterface.removeColumn('Experiences', 'title');

    // await queryInterface.removeConstraint(
    //   'Formations',
    //   'Formations_CVId_fkey'
    // );

  }
};
