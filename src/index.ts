import { diff, Diff, DiffEdit } from "deep-diff";

export interface Differences {
    [field: string]: {
        left: unknown;
        right: unknown;
    };
}

export type PathFilter = (pathElements: string[]) => boolean;
export type TransformValueFunction = (value: unknown) => unknown;
export type EqualsFunction = (left: unknown, right: unknown) => boolean;
export type PathCompareTransformationsProvider = (
    pathElements: string[]
) => TransformValueFunction[] | undefined | null;

const toString: TransformValueFunction = (value: unknown) => (value ? `${value}` : value);
const trimString: TransformValueFunction = (value: unknown) =>
    value && typeof value === "string" ? value.trim() : value;
const uppercaseString: TransformValueFunction = (value: unknown) =>
    value && typeof value === "string" ? value.toUpperCase() : value;
const nullOfUndefinedAsEmptyString: TransformValueFunction = (value: unknown) =>
    value === null || value === undefined ? "" : value;

export const StringTransformations = {
    toString,
    trim: trimString,
    uppercase: uppercaseString,
    nullOfUndefinedAsEmptyString
};

export type CompareOptions = {
    //A function to specify which path of comparaison should be included in the compare
    //Function should return true with the path should be included
    pathFilter?: PathFilter;
    //Provide a list of transformation to be applied when comparing any values.
    compareTransformations?: TransformValueFunction[];
    //This is a specialized version of the compareTransformations option. The factory can provide a list of
    //transformations for a specific path. If the factory returns a list function, it will be used instead of the
    //global compareTransformations.
    pathCompareTransformationsProvider?: PathCompareTransformationsProvider;
};

function isDate(obj: unknown): boolean {
    return Object.prototype.toString.call(obj) === "[object Date]";
}

const isPlainObject = function(obj: unknown): boolean {
    return Object.prototype.toString.call(obj) === "[object Object]";
};

const flattenObject = (obj: any, prefix: string, res: any = {}) => {
    return Object.entries(obj).reduce((r, [key, val]) => {
        const k = `${prefix}${key}`;
        if (val && isPlainObject(val)) {
            flattenObject(val, `${k}.`, r);
        } else {
            res[k] = val;
        }
        return r;
    }, res);
};

function applyTransformations(transformations: TransformValueFunction[], value: unknown) {
    let finalValue = value;
    transformations.forEach(t => {
        finalValue = t(finalValue);
    });
    return finalValue;
}

function createCompareFunction(compareTransformations?: TransformValueFunction[]): EqualsFunction {
    return (left: unknown, right: unknown) => {
        const finalLeft = applyTransformations(compareTransformations || [], left);
        const finalRight = applyTransformations(compareTransformations || [], right);
        if (isDate(finalLeft) && isDate(finalRight)) {
            return (finalLeft as Date).getTime() - (finalRight as Date).getTime() === 0;
        }
        return finalLeft === finalRight;
    };
}

function getMeaningfulDifferences(differences: Diff<unknown, unknown>[], options: CompareOptions) {
    let meaningfulDifferences = differences;
    if (options.pathFilter) {
        meaningfulDifferences = differences.filter((diff: Diff<unknown, unknown>): boolean => {
            //diff.path can be empty using deep-diff, but since we never compare null with an object, it will never
            //be undefined for us. We also have to recheck options.pathFilter to make typescript happy
            /* istanbul ignore next */
            if (diff.path && options.pathFilter) {
                return options.pathFilter(diff.path || []);
            }
            /* istanbul ignore next */
            throw new Error("Unexpected error in pathFiltering");
        });
    }
    return meaningfulDifferences.filter((diff: Diff<unknown, unknown>): boolean => {
        if (diff.kind === "E") {
            const diffEdit = diff as DiffEdit<unknown, unknown>;
            /* istanbul ignore next */
            const pathElements = diffEdit.path ? diffEdit.path : null;
            const pathTransformations =
                pathElements && options.pathCompareTransformationsProvider
                    ? options.pathCompareTransformationsProvider(pathElements)
                    : undefined;
            if (pathTransformations) {
                return !createCompareFunction(pathTransformations)(diffEdit.lhs, diffEdit.rhs);
            }

            const globalCompareFunction = createCompareFunction(options.compareTransformations);
            return !globalCompareFunction(diffEdit.lhs, diffEdit.rhs);
        }
        return true;
    });
}

export function getDifferences(left: unknown, right: unknown, options: CompareOptions = {}): Differences {
    left = left || {};
    right = right || {};

    const differences = diff(left, right);
    if (differences) {
        const meaningfulDifferences = getMeaningfulDifferences(differences, options);
        return meaningfulDifferences.reduce((acc: Differences, diff: any): Differences => {
            const pathString = diff.path.join(".");
            const lhsDefined = !(diff.lhs === null || diff.lhs === undefined);
            const rhsDefined = !(diff.rhs === null || diff.rhs === undefined);
            //When a property is missing on one side, and an object on the other side, deep-diff
            //will not go deep inside the object and will report this as one difference. In that
            //case (null or undefined on one side, and on object on the other), we flatten the object
            //and report every nested field as a difference, with undefined as the compare value
            if (lhsDefined && isPlainObject(diff.lhs) && !rhsDefined) {
                const nestedDiffs = flattenObject(diff.lhs, `${pathString}.`);
                Object.entries(nestedDiffs).forEach(([key, value]) => {
                    acc[key] = {
                        left: value,
                        right: undefined
                    };
                });
            } else if (rhsDefined && isPlainObject(diff.rhs) && !lhsDefined) {
                const nestedDiffs = flattenObject(diff.rhs, `${pathString}.`);
                Object.entries(nestedDiffs).forEach(([key, value]) => {
                    acc[key] = {
                        left: undefined,
                        right: value
                    };
                });
            } else {
                acc[pathString] = {
                    left: diff.lhs !== undefined ? diff.lhs : undefined,
                    right: diff.rhs !== undefined ? diff.rhs : undefined
                };
            }
            return acc;
        }, {});
    }
    return {};
}
