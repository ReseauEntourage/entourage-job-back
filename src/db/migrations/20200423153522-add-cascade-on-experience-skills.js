module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeConstraint(
          'Experience_Skills',
          'Experience_Skills_ExperienceId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.removeConstraint(
          'Experience_Skills',
          'Experience_Skills_SkillId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('Experience_Skills', {
          fields: ['ExperienceId'],
          type: 'foreign key',
          name: 'Experience_Skills_ExperienceId_fkey',
          references: {
            table: 'Experiences',
            field: 'id',
          },
          onDelete: 'cascade',
          onUpdate: 'cascade',
          transaction: t,
        }),
        queryInterface.addConstraint('Experience_Skills', {
          fields: ['SkillId'],
          type: 'foreign key',
          name: 'Experience_Skills_SkillId_fkey',
          references: {
            table: 'Skills',
            field: 'id',
          },
          onDelete: 'cascade',
          onUpdate: 'cascade',
          transaction: t,
        }),
      ]);
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeConstraint(
          'Experience_Skills',
          'Experience_Skills_ExperienceId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.removeConstraint(
          'Experience_Skills',
          'Experience_Skills_SkillId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('Experience_Skills', {
          fields: ['ExperienceId'],
          type: 'foreign key',
          name: 'Experience_Skills_ExperienceId_fkey',
          references: {
            table: 'Experiences',
            field: 'id',
          },
          transaction: t,
        }),
        queryInterface.addConstraint('Experience_Skills', {
          fields: ['SkillId'],
          type: 'foreign key',
          name: 'Experience_Skills_SkillId_fkey',
          references: {
            table: 'Skills',
            field: 'id',
          },
          transaction: t,
        }),
      ]);
    });
  },
};
