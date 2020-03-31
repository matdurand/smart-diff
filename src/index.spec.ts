import { getDifferences, Differences, PathFilter, StringTransformations } from "./index";
import { get } from "lodash";
import moment from "moment";

const expectDiffCount = (diff: Differences, expectedCount: number) => {
    expect(Object.keys(diff).length, `There should be exactly ${expectedCount} differences`).toBe(expectedCount);
};

const expectDiffOnProperty = (diff: Differences, property: string, left: unknown, right: unknown) => {
    const propertyDiff = get(diff, property);
    expect(
        propertyDiff,
        `A difference should be present for property [${property}] but there was none. Existing differences are [${Object.keys(
            diff
        )}]`
    ).not.toBeFalsy();
    expect(propertyDiff.left, `Left difference for property [${property}] should match`).toEqual(left);
    expect(propertyDiff.right, `Right difference for property [${property}] should match`).toEqual(right);
};

const whitelistProperties = (properties: string[]): PathFilter => {
    return (paths: string[]) => {
        return paths.filter(x => properties.includes(x)).length > 0;
    };
};

const blacklistProperties = (properties: string[]): PathFilter => {
    return (paths: string[]) => {
        return paths.filter(x => properties.includes(x)).length === 0;
    };
};

const johnProfile = { age: 19, name: "john", nip: null, emails: { primary: "john@example.com" } };
const fredProfile = {
    age: 32,
    name: "fred",
    nip: null,
    emails: { primary: "fred@example.com", work: "fred@mycompany.com" }
};

describe("smart-differences", () => {
    describe("getDifferences", () => {
        it("should return all field from left when right is null", () => {
            const diffs = getDifferences(johnProfile, null);
            expectDiffCount(diffs, 4);
            expectDiffOnProperty(diffs, "age", 19, undefined);
            expectDiffOnProperty(diffs, "name", "john", undefined);
            expectDiffOnProperty(diffs, "nip", null, undefined);
            expectDiffOnProperty(diffs, "emails.primary", "john@example.com", undefined);
        });

        it("should return all field from right when left is null", () => {
            const diffs = getDifferences(null, johnProfile);
            expectDiffCount(diffs, 4);
            expectDiffOnProperty(diffs, "age", undefined, 19);
            expectDiffOnProperty(diffs, "name", undefined, "john");
            expectDiffOnProperty(diffs, "nip", undefined, null);
            expectDiffOnProperty(diffs, "emails.primary", undefined, "john@example.com");
        });

        it("should return an empty object when there is no differences", () => {
            const diffs = getDifferences(johnProfile, johnProfile);
            expectDiffCount(diffs, 0);
        });

        it("should return a difference when the case is not the same for a property", () => {
            const diffs = getDifferences(johnProfile, { ...johnProfile, name: "JOHn" });
            expectDiffCount(diffs, 1);
            expectDiffOnProperty(diffs, "name", "john", "JOHn");
        });

        it("should return a difference when the type is not the same for a property", () => {
            const diffs = getDifferences(johnProfile, { ...johnProfile, age: "19" });
            expectDiffCount(diffs, 1);
            expectDiffOnProperty(diffs, "age", 19, "19");
        });

        it("should return no difference for a date property when the date is the same", () => {
            const diffs = getDifferences(
                {
                    d1: new Date("2000-02-01T00:00:00.000Z")
                },
                {
                    d1: new Date("2000-02-01T00:00:00.000Z")
                }
            );
            expectDiffCount(diffs, 0);
        });

        it("should return a difference for a date property when the date is not the same", () => {
            const diffs = getDifferences(
                {
                    d1: new Date("2000-02-01T00:00:00.000Z")
                },
                {
                    d1: new Date("2000-02-02T00:00:00.000Z")
                }
            );
            expectDiffCount(diffs, 1);
            expectDiffOnProperty(
                diffs,
                "d1",
                new Date("2000-02-01T00:00:00.000Z"),
                new Date("2000-02-02T00:00:00.000Z")
            );
        });

        describe("with options", () => {
            describe("using path filtering", () => {
                describe("using whitelisting", () => {
                    it("should only include the path where the pathFilter function returns true", () => {
                        const diffs = getDifferences(johnProfile, fredProfile, {
                            pathFilter: whitelistProperties(["age", "name"])
                        });
                        expectDiffCount(diffs, 2);
                        expectDiffOnProperty(diffs, "age", 19, 32);
                        expectDiffOnProperty(diffs, "name", "john", "fred");
                    });
                });

                describe("using blacklisting", () => {
                    it("should only include the path where the pathFilter function returns true", () => {
                        const diffs = getDifferences(johnProfile, fredProfile, {
                            pathFilter: blacklistProperties(["age", "name"])
                        });
                        expectDiffCount(diffs, 2);
                        expectDiffOnProperty(diffs, "emails.primary", "john@example.com", "fred@example.com");
                        expectDiffOnProperty(diffs, "emails.work", undefined, "fred@mycompany.com");
                    });
                });
            });

            describe("using uppercase transformation option", () => {
                it("should ignore string properties where the only difference is the case", () => {
                    const diffs = getDifferences(
                        johnProfile,
                        { ...johnProfile, name: "JOHn", emails: { primary: "JOHn2@example.COM" } },
                        {
                            compareTransformations: [StringTransformations.uppercase]
                        }
                    );
                    expectDiffCount(diffs, 1);
                    expectDiffOnProperty(diffs, "emails.primary", "john@example.com", "JOHn2@example.COM");
                });
            });

            describe("using trim transformation option", () => {
                it("should ignore string properties where the only difference is extra space before and after values", () => {
                    const diffs = getDifferences(
                        johnProfile,
                        { ...johnProfile, name: "john  ", emails: { primary: "  john@example.com" } },
                        {
                            compareTransformations: [StringTransformations.trim]
                        }
                    );
                    expectDiffCount(diffs, 0);
                });
            });

            describe("using toString transformation option", () => {
                it("should ignore difference when the string values are equal", () => {
                    const diffs = getDifferences(
                        johnProfile,
                        { ...johnProfile, age: "19" },
                        {
                            compareTransformations: [StringTransformations.toString]
                        }
                    );
                    expectDiffCount(diffs, 0);
                });
            });

            describe("using nullOfUndefinedAsEmptyString transformation option", () => {
                it("should ignore difference when the string values are equal", () => {
                    const diffs = getDifferences(
                        { ...johnProfile, name: "" },
                        { ...johnProfile, name: null },
                        {
                            compareTransformations: [StringTransformations.nullOfUndefinedAsEmptyString]
                        }
                    );
                    expectDiffCount(diffs, 0);
                });
            });

            describe("using a date transformation option", () => {
                it("should compare dates as time value", () => {
                    const compareDatesAtStartOfDay = (value: unknown) => {
                        if (value && (value as any)["setHours"]) {
                            return moment(value as Date)
                                .utc()
                                .startOf("day")
                                .toDate();
                        }
                        return value;
                    };
                    const diffs = getDifferences(
                        { d1: new Date("2000-02-01T00:00:00.000Z") },
                        { d1: new Date("2000-02-01T05:00:00.000Z") },
                        {
                            compareTransformations: [compareDatesAtStartOfDay]
                        }
                    );
                    expectDiffCount(diffs, 0);
                });
            });

            describe("using a custom propertyEqualsFunctionFactory option", () => {
                it("should only report difference when the function returns false for a specified property", () => {
                    const diffs = getDifferences(
                        johnProfile,
                        { ...johnProfile, name: "  john", emails: { primary: "  john@example.com" } },
                        {
                            pathCompareTransformationsProvider: (pathElements: string[]) => {
                                const property = pathElements.join(".");
                                //trim, but only for emails.primary
                                if (property === "emails.primary") {
                                    return [StringTransformations.trim];
                                }
                                return null;
                            }
                        }
                    );
                    expectDiffCount(diffs, 1);
                    expectDiffOnProperty(diffs, "name", "john", "  john");
                });
            });

            describe("a complex case", () => {
                it("should report expected differences", () => {
                    const object1 = {
                        firstName: "john",
                        lastName: "mcclane ",
                        killCount: "251",
                        nip: undefined,
                        address: {
                            civicNumber: 1014,
                            street: null,
                            city: "Los Angeles",
                            postalCode: "W2k 7r9"
                        },
                        emails: {
                            primary: undefined,
                            secondary: undefined
                        },
                        phones: {
                            primary: "1877ASKHELP"
                        }
                    };
                    const object2 = {
                        firstName: "John",
                        lastName: "McClane",
                        killCount: 251,
                        nip: null,
                        phones: {
                            primary: "1-877-ask-help"
                        },
                        emails: {
                            primary: "smart.ass@diehard.com",
                            secondary: ""
                        },
                        address: {
                            civicNumber: "1014",
                            street: "Pacific Coast Highway",
                            city: "Los Angeles",
                            postalCode: "W2K7R9"
                        },
                        favoriteSong: {
                            name: "Winter Wonderland",
                            artist: {
                                name: "Felix Bernard"
                            },
                            year: 1934
                        }
                    };
                    const removeSequenceTransformation = (seq: string) => (value: unknown) =>
                        value && typeof value === "string" ? value.replace(new RegExp(seq, "g"), "") : value;
                    const diffs = getDifferences(object1, object2, {
                        compareTransformations: [StringTransformations.uppercase, StringTransformations.trim],
                        pathCompareTransformationsProvider: (pathElements: string[]) => {
                            const property = pathElements.join(".");
                            switch (property) {
                                case "killCount":
                                case "address.civicNumber":
                                    return [StringTransformations.toString];
                                case "address.street":
                                    return [StringTransformations.toString];
                                case "address.postalCode":
                                    return [StringTransformations.uppercase, removeSequenceTransformation(" ")];
                                case "phones.primary":
                                    return [StringTransformations.uppercase, removeSequenceTransformation("-")];
                                case "emails.primary":
                                case "emails.secondary":
                                    return [
                                        StringTransformations.nullOfUndefinedAsEmptyString,
                                        StringTransformations.uppercase
                                    ];
                            }
                            return null;
                        }
                    });
                    expectDiffCount(diffs, 6);
                    expectDiffOnProperty(diffs, "nip", undefined, null);
                    expectDiffOnProperty(diffs, "address.street", null, "Pacific Coast Highway");
                    expectDiffOnProperty(diffs, "emails.primary", undefined, "smart.ass@diehard.com");
                    expectDiffOnProperty(diffs, "favoriteSong.name", undefined, "Winter Wonderland");
                    expectDiffOnProperty(diffs, "favoriteSong.artist.name", undefined, "Felix Bernard");
                    expectDiffOnProperty(diffs, "favoriteSong.year", undefined, 1934);
                });
            });
        });
    });
});
