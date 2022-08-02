/* eslint-disable no-underscore-dangle */

import { Model } from 'sequelize';
import { CV, CVBusinessLine, CVLocation } from '../../cvs';

type AllModels = CVLocation | CVBusinessLine;

export async function paranoidDeleteCascade(
  models: AllModels[],
  instance: typeof CV
) {
  /* // Only operate on paranoid models
  if (!instance.constructor.options.paranoid) {
    return Promise.resolve();
  }

  const modelName = instance.constructor.options.name.singular;

  const associations = instance.associations;

  await Promise.all(
    // Go over all associations of the instance model, and delete if needed
    Object.keys(associations).map(async (associationKey) => {
      try {
        // Only delete if cascade is set up correctly
        if (associations[associationKey].options.onDelete !== 'CASCADE') {
          return Promise.resolve();
        }

        const getOptions = {};

        // Handle "through" cases

        /!*
          Remove for now because the Many-to-Many associations are not configured correctly

          let relationModel = associations[associationKey].target;

          if (associations[associationKey].through) {
           relationModel = associations[associationKey].through.model;

           // Include the id of the through model instance
           getOptions.include = [
             {
               model: relationModel,
             },
           ];
          }
        *!/

        const modelAs = associations[associationKey].as;

        // Load id(s) of association
        const instances = await instance[
          `get${modelAs.charAt(0).toUpperCase() + modelAs.substring(1)}`
        ](getOptions);

        if (Array.isArray(instances)) {
          // Association has no results so nothing to delete
          if (instances.length === 0) {
            return Promise.resolve();
          }

          // Delete all individually as bulk delete doesn't cascade in sequelize
          return await Promise.all(
            instances.map((i) => {
              return i.destroy();
            })
          );
        }

        // Association is not set, so nothing to delete
        if (!instances) {
          return Promise.resolve();
        }

        return await instances.destroy();
      } catch (error) {
        // If we had issues deleting, we have bigger problems
        console.error(
          "Failed to delete models associated to the user's CV",
          error
        );
        return Promise.resolve();
      }
    })
  );*/
}
