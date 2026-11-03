export const validate = (schema, source = 'body') => {
  return async (req, res, next) => {
    try {
      const dataToValidate = req[source];
      const validated = await schema.parseAsync(dataToValidate);
      req[source] = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export default validate;
