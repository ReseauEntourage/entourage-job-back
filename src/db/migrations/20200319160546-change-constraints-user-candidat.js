module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeConstraint(
          'User_Candidats',
          'User_Candidats_candidatId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.removeConstraint(
          'User_Candidats',
          'User_Candidats_coachId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('User_Candidats', {
          fields: ['candidatId'],
          type: 'foreign key',
          name: 'User_Candidats_candidatId_fkey',
          references: {
            table: 'Users',
            field: 'id',
          },
          onDelete: 'cascade',
          onUpdate: 'cascade',
          transaction: t,
        }),
        queryInterface.addConstraint('User_Candidats', {
          fields: ['coachId'],
          type: 'foreign key',
          name: 'User_Candidats_coachId_fkey',
          references: {
            table: 'Users',
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
          'User_Candidats',
          'User_Candidats_candidatId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.removeConstraint(
          'User_Candidats',
          'User_Candidats_coachId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('User_Candidats', {
          fields: ['candidatId'],
          type: 'foreign key',
          name: 'User_Candidats_candidatId_fkey',
          references: {
            table: 'Users',
            field: 'id',
          },
          transaction: t,
        }),
        queryInterface.addConstraint('User_Candidats', {
          fields: ['coachId'],
          type: 'foreign key',
          name: 'User_Candidats_coachId_fkey',
          references: {
            table: 'Users',
            field: 'id',
          },
          transaction: t,
        }),
      ]);
    });
  },
};
