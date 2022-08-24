module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeConstraint(
          'CV_Ambitions',
          'CV_Ambitions_AmbitionId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.removeConstraint(
          'CV_Contracts',
          'CV_Contracts_ContractId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.removeConstraint(
          'CV_Languages',
          'CV_Languages_LanguageId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.removeConstraint(
          'CV_Passions',
          'CV_Passions_PassionId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.removeConstraint('CV_Skills', 'CV_Skills_SkillId_fkey', {
          transaction: t,
        }),
      ]);
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addConstraint('CV_Ambitions', {
          fields: ['AmbitionId'],
          type: 'foreign key',
          name: 'CV_Ambitions_AmbitionId_fkey',
          references: {
            table: 'Ambitions',
            field: 'id',
          },
          transaction: t,
        }),
        queryInterface.addConstraint('CV_Contracts', {
          fields: ['ContractId'],
          type: 'foreign key',
          name: 'CV_Contracts_ContractId_fkey',
          references: {
            table: 'Contracts',
            field: 'id',
          },
          transaction: t,
        }),
        queryInterface.addConstraint('CV_Languages', {
          fields: ['LanguageId'],
          type: 'foreign key',
          name: 'CV_Languages_LanguageId_fkey',
          references: {
            table: 'Languages',
            field: 'id',
          },
          transaction: t,
        }),
        queryInterface.addConstraint('CV_Passions', {
          fields: ['PassionId'],
          type: 'foreign key',
          name: 'CV_Passions_PassionId_fkey',
          references: {
            table: 'Passions',
            field: 'id',
          },
          transaction: t,
        }),
        queryInterface.addConstraint('CV_Skills', {
          fields: ['SkillId'],
          type: 'foreign key',
          name: 'CV_Skills_SkillId_fkey',
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
