# smart-differences

This library provides multiple ways to compare javascript objects.

## Installation

For NPM:

```
npm install --save smart-differences
```

For yarn

```
yarn add smart-differences
```

## Usage

Here is an example of how to use the library:

```
const johnProfile = { age: 19, name: "john", emails: { primary: "john@example.com" } };
const fredProfile = { age: 32, name: "fred",
    emails: { primary: "fred@example.com", work: "fred@mycompany.com" }
};
const diffs = getDifferences(johnProfile, fredProfile);
console.log(diffs);
```

This would print the following:
```
{ 
  'age': { left: 19, right: 32 },
  'name': { left: 'john', right: 'fred' },
  'emails.primary': { left: 'john@example.com', right: 'fred@example.com' },
  'emails.work': { left: undefined, right: 'fred@mycompany.com' } 
}
```

### Customizing the comparaison

There is 3 main ways to customize the comparaison using the options:

#### pathFilter

Used to include or exclude some path from the comparaison. Using the same objects as above (fred and john):
```
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

const diffsWhitelist = getDifferences(johnProfile, fredProfile, {
    pathFilter: whitelistProperties(["age", "name"])
});
const diffsBlacklist = getDifferences(johnProfile, fredProfile, {
    pathFilter: blacklistProperties(["age", "name"])
});
console.log(diffsWhitelist);
console.log(diffsBlacklist);
```

would return

```
//whitelist
{ 
   age: { left: 19, right: 32 },
   name: { left: 'john', right: 'fred' } 
}
/blacklist
{
  'emails.primary': { left: 'john@example.com', right: 'fred@example.com' },
  'emails.work': { left: undefined, right: 'fred@mycompany.com' } 
}
```

Beware when using pathFiltering and not using the deepCompare option below, you will
receive the head property of a nested object, not not the properties below. For example
(based on the deepCompare example below), your filter would receive:
```
[name, favoriteSong]
```

When using deepCompare, it would receive:
```
[name, favoriteSong.name, favoriteSong.artist.name, favoriteSong.year]
```

#### deepCompare

Deep compare is an option used when one side of the comparaison is null or undefined, and the other side is an
object.

Here is two output of the same compare with and without deepCompare.

```
const object1 = {
  name: "John",
  favoriteSong: {
      name: "Winter Wonderland",
      artist: {
          name: "Felix Bernard"
      },
      year: 1934
  }
};
const object2 = {
  name: "Fred"
};
```

```
//with deepCompare, the differences would be
{ 
  name: { left: 'John', right: 'Fred' },
  'favoriteSong.name': { left: 'Winter Wonderland', right: undefined },
  'favoriteSong.artist.name': { left: 'Felix Bernard', right: undefined },
  'favoriteSong.year': { left: 1934, right: undefined } 
}

//without deepCompare
{ 
  name: { left: 'John', right: 'Fred' },
  favoriteSong: { 
    left: { 
      name: 'Winter Wonderland', 
      artist: {
          name: "Felix Bernard"
      }, 
      year: 1934 
    },
    right: undefined 
  } 
}
```

#### Transformations

You can also apply transformations to the values before compare, for example to ignore case or extra spaces.

The first way to do it is globally using the `compareTransformations` option. The library export an object named
`StringTransformations` with a couple of predefined function, but you can build your own.

```
const diffs = getDifferences(
    johnProfile,
    { ...johnProfile, name: "JOHn", emails: { primary: "JOHn@example.COM" } },
    {
        compareTransformations: [StringTransformations.uppercase]
    }
);
```
would return no differences.

You can also apply the transformations for each property individually using the `pathCompareTransformationsProvider`.

```
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
```

would only trim the spaces for the primary email, and would still detect a difference for the extra spaces in the name
property. It would print

```
{ 
  name: { left: 'john', right: '  john' } 
}
```

When you return null or undefined in the `pathCompareTransformationsProvider` function, no transformations are applied.
If you defined some transformations in the `compareTransformations` option, they are only applied if the
`pathCompareTransformationsProvider` function returns null or undefined.

## Known issues

Right now, this library doesn't work when comparing `Array` properties. This is gonna be
available in the next release.