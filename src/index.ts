import { diff, Diff, DiffEdit, DiffNew, DiffDeleted } from "deep-diff";

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
    //This applies when comparing a property which is null or undefined and an object on the other side.
    //When using deepCompare (default false), it will compare each nested property of the object and
    //report a difference compared to the value undefined. With deepCompare = false, it will only report
    //a single difference. See examples.
    deepCompare?: boolean;
    //Provide a list of transformation to be applied when comparing any values.
    compareTransformations?: TransformValueFunction[];
    //This is a specialized version of the compareTransformations option. The factory can provide a list of
    //transformations for a specific path. If the factory returns a list function, it will be used instead of the
    //global compareTransformations.
    pathCompareTransformationsProvider?: PathCompareTransformationsProvider;
};

function flatMap<T, U>(array: T[], callbackfn: (value: T, index: number, array: T[]) => U[]): U[] {
    return Array.prototype.concat(...array.map(callbackfn));
}

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

function getExplodedDifferences(differences: Diff<unknown, unknown>[]): Diff<unknown, unknown>[] {
    //When a property is missing on one side (null or undefined), and there is an object on the other side,
    //deep-diff will not go deep inside the object and will report this as one difference. In that case
    //(null or undefined on one side, and on object on the other), we flatten the object and report every
    //nested field as a difference, with undefined as the compare value
    const diffNewObjectFilter = (diff: any) => diff.kind === "N" && isPlainObject(diff.rhs);
    const diffDeletedObjectFilter = (diff: any) => diff.kind === "D" && isPlainObject(diff.lhs);

    const diffNewAdditions = flatMap(differences.filter(diffNewObjectFilter), (diff: any) => {
        const pathString = diff.path.join(".");
        return Object.entries(flattenObject(diff.rhs, `${pathString}.`)).map(([key, value]) => {
            return {
                kind: "N",
                path: key.split("."),
                rhs: value
            } as DiffNew<unknown>;
        });
    });

    const diffDeletedAdditions = flatMap(differences.filter(diffDeletedObjectFilter), (diff: any) => {
        const pathString = diff.path.join(".");
        return Object.entries(flattenObject(diff.lhs, `${pathString}.`)).map(([key, value]) => {
            return {
                kind: "D",
                path: key.split("."),
                lhs: value
            } as DiffDeleted<unknown>;
        });
    });

    return [
        ...differences.filter(d => !diffNewObjectFilter(d) && !diffDeletedObjectFilter(d)),
        ...diffNewAdditions,
        ...diffDeletedAdditions
    ];
}

export function getDifferences(left: unknown, right: unknown, options: CompareOptions = {}): Differences {
    left = left || {};
    right = right || {};

    const differences = diff(left, right);
    if (differences) {
        const extendedDifferences = options.deepCompare ? getExplodedDifferences(differences) : differences;
        const meaningfulDifferences = getMeaningfulDifferences(extendedDifferences, options);
        return meaningfulDifferences.reduce((acc: Differences, diff: any): Differences => {
            const pathString = diff.path.join(".");
            acc[pathString] = {
                left: diff.lhs !== undefined ? diff.lhs : undefined,
                right: diff.rhs !== undefined ? diff.rhs : undefined
            };
            return acc;
        }, {});
    }
    return {};
}
