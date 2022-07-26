export default {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        // Locations
        queryInterface.removeConstraint(
          'CV_Locations',
          'CV_Locations_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Locations', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Locations_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'CV_Locations',
          'CV_Locations_LocationId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Locations', {
          fields: ['LocationId'],
          type: 'foreign key',
          name: 'CV_Locations_LocationId_fkey',
          references: {
            table: 'Locations',
            field: 'id',
          },
          onDelete: 'NO ACTION',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // BusinessLines
        queryInterface.removeConstraint(
          'CV_BusinessLines',
          'CV_BusinessLines_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_BusinessLines', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_BusinessLines_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'CV_BusinessLines',
          'CV_BusinessLines_BusinessLineId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_BusinessLines', {
          fields: ['BusinessLineId'],
          type: 'foreign key',
          name: 'CV_BusinessLines_BusinessLineId_fkey',
          references: {
            table: 'BusinessLines',
            field: 'id',
          },
          onDelete: 'NO ACTION',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // Ambitions
        queryInterface.removeConstraint(
          'CV_Ambitions',
          'CV_Ambitions_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Ambitions', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Ambitions_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'CV_Ambitions',
          'CV_Ambitions_AmbitionId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Ambitions', {
          fields: ['AmbitionId'],
          type: 'foreign key',
          name: 'CV_Ambitions_AmbitionId_fkey',
          references: {
            table: 'Ambitions',
            field: 'id',
          },
          onDelete: 'NO ACTION',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // Contracts
        queryInterface.removeConstraint(
          'CV_Contracts',
          'CV_Contracts_ContractId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Contracts', {
          fields: ['ContractId'],
          type: 'foreign key',
          name: 'CV_Contracts_ContractId_fkey',
          references: {
            table: 'Contracts',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'CV_Contracts',
          'CV_Contracts_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Contracts', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Contracts_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'NO ACTION',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // Languages
        queryInterface.removeConstraint(
          'CV_Languages',
          'CV_Languages_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Languages', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Languages_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'CV_Languages',
          'CV_Languages_LanguageId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Languages', {
          fields: ['LanguageId'],
          type: 'foreign key',
          name: 'CV_Languages_LanguageId_fkey',
          references: {
            table: 'Languages',
            field: 'id',
          },
          onDelete: 'NO ACTION',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // Passions
        queryInterface.removeConstraint(
          'CV_Passions',
          'CV_Passions_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Passions', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Passions_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'CV_Passions',
          'CV_Passions_PassionId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Passions', {
          fields: ['PassionId'],
          type: 'foreign key',
          name: 'CV_Passions_PassionId_fkey',
          references: {
            table: 'Passions',
            field: 'id',
          },
          onDelete: 'NO ACTION',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // Skills
        queryInterface.removeConstraint('CV_Skills', 'CV_Skills_CVId_fkey', {
          transaction: t,
        }),
        queryInterface.addConstraint('CV_Skills', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Skills_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint('CV_Skills', 'CV_Skills_SkillId_fkey', {
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
          onDelete: 'NO ACTION',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // Experience Skills
        queryInterface.removeConstraint(
          'Experience_Skills',
          'Experience_Skills_ExperienceId_fkey',
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
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'Experience_Skills',
          'Experience_Skills_SkillId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('Experience_Skills', {
          fields: ['SkillId'],
          type: 'foreign key',
          name: 'Experience_Skills_SkillId_fkey',
          references: {
            table: 'Skills',
            field: 'id',
          },
          onDelete: 'NO ACTION',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
      ]);
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        // Locations
        queryInterface.removeConstraint(
          'CV_Locations',
          'CV_Locations_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Locations', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Locations_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'CV_Locations',
          'CV_Locations_LocationId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Locations', {
          fields: ['LocationId'],
          type: 'foreign key',
          name: 'CV_Locations_LocationId_fkey',
          references: {
            table: 'Locations',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // BusinessLines
        queryInterface.removeConstraint(
          'CV_BusinessLines',
          'CV_BusinessLines_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_BusinessLines', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_BusinessLines_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'CV_BusinessLines',
          'CV_BusinessLines_BusinessLineId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_BusinessLines', {
          fields: ['BusinessLineId'],
          type: 'foreign key',
          name: 'CV_BusinessLines_BusinessLineId_fkey',
          references: {
            table: 'BusinessLines',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // Ambitions
        queryInterface.removeConstraint(
          'CV_Ambitions',
          'CV_Ambitions_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Ambitions', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Ambitions_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'CV_Ambitions',
          'CV_Ambitions_AmbitionId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Ambitions', {
          fields: ['AmbitionId'],
          type: 'foreign key',
          name: 'CV_Ambitions_AmbitionId_fkey',
          references: {
            table: 'Ambitions',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // Contracts
        queryInterface.removeConstraint(
          'CV_Contracts',
          'CV_Contracts_ContractId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Contracts', {
          fields: ['ContractId'],
          type: 'foreign key',
          name: 'CV_Contracts_ContractId_fkey',
          references: {
            table: 'Contracts',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'CV_Contracts',
          'CV_Contracts_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Contracts', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Contracts_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // Languages
        queryInterface.removeConstraint(
          'CV_Languages',
          'CV_Languages_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Languages', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Languages_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'CV_Languages',
          'CV_Languages_LanguageId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Languages', {
          fields: ['LanguageId'],
          type: 'foreign key',
          name: 'CV_Languages_LanguageId_fkey',
          references: {
            table: 'Languages',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // Passions
        queryInterface.removeConstraint(
          'CV_Passions',
          'CV_Passions_CVId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Passions', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Passions_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'CV_Passions',
          'CV_Passions_PassionId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('CV_Passions', {
          fields: ['PassionId'],
          type: 'foreign key',
          name: 'CV_Passions_PassionId_fkey',
          references: {
            table: 'Passions',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // Skills
        queryInterface.removeConstraint('CV_Skills', 'CV_Skills_CVId_fkey', {
          transaction: t,
        }),
        queryInterface.addConstraint('CV_Skills', {
          fields: ['CVId'],
          type: 'foreign key',
          name: 'CV_Skills_CVId_fkey',
          references: {
            table: 'CVs',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint('CV_Skills', 'CV_Skills_SkillId_fkey', {
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
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),

        // Experience Skills
        queryInterface.removeConstraint(
          'Experience_Skills',
          'Experience_Skills_ExperienceId_fkey',
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
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
        queryInterface.removeConstraint(
          'Experience_Skills',
          'Experience_Skills_SkillId_fkey',
          {
            transaction: t,
          }
        ),
        queryInterface.addConstraint('Experience_Skills', {
          fields: ['SkillId'],
          type: 'foreign key',
          name: 'Experience_Skills_SkillId_fkey',
          references: {
            table: 'Skills',
            field: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          transaction: t,
        }),
      ]);
    });
  },
};
