import { describe, expect, it } from 'vitest';
import { expandSearchTerms, filterIconNames, getSearchSuggestions } from './searchSynonyms';

describe('hugeicons search synonyms', () => {
  it('expands short Spanish airplane prefixes into airplane icon terms', () => {
    expect(expandSearchTerms('avi')).toEqual(
      expect.arrayContaining(['airplane', 'aircraft', 'plane', 'avion'])
    );
    expect(expandSearchTerms('avio')).toEqual(
      expect.arrayContaining(['airplane', 'aircraft', 'plane', 'avion'])
    );
  });

  it('lets broad prefixes fan out across every matching synonym group', () => {
    const results = filterIconNames(
      ['Airplane01Icon', 'AircraftGameIcon', 'PlaneIcon', 'Notification01Icon'],
      'avi'
    );

    expect(results).toEqual(['Airplane01Icon', 'AircraftGameIcon', 'PlaneIcon', 'Notification01Icon']);
  });

  it('narrows naturally as the typed prefix becomes more specific', () => {
    const results = filterIconNames(
      ['Airplane01Icon', 'AircraftGameIcon', 'PlaneIcon', 'Notification01Icon'],
      'avio'
    );

    expect(results).toEqual(['Airplane01Icon', 'AircraftGameIcon', 'PlaneIcon']);
  });

  it('keeps exact short terms narrower than broader prefix matches', () => {
    expect(expandSearchTerms('bus')).toEqual(expect.arrayContaining(['autobus', 'camioneta']));
    expect(expandSearchTerms('bus')).not.toEqual(expect.arrayContaining(['buscar', 'busqueda']));
  });

  it('does not match planet across adjacent airplane words', () => {
    expect(filterIconNames(['AirplaneTakeOff01Icon', 'PlanetIcon'], 'planet')).toEqual(['PlanetIcon']);
  });

  it('ranks direct name prefixes above related synonym hits', () => {
    expect(filterIconNames(['PlaneIcon', 'Airplane01Icon'], 'airp')).toEqual([
      'Airplane01Icon',
      'PlaneIcon',
    ]);
  });

  it('tolerates common typos in English icon words and Spanish synonym keys', () => {
    expect(filterIconNames(['Airplane01Icon', 'Notification01Icon'], 'airplne')).toEqual([
      'Airplane01Icon',
    ]);
    expect(filterIconNames(['Airplane01Icon', 'Notification01Icon'], 'notificasion')).toEqual([
      'Notification01Icon',
    ]);
  });

  it('normalizes simple singular and plural variants', () => {
    expect(filterIconNames(['DocumentIcon', 'FolderIcon'], 'documents')).toEqual(['DocumentIcon']);
    expect(filterIconNames(['UserIcon', 'TaskIcon'], 'usuarios')).toEqual(['UserIcon']);
  });

  it('supports initials from PascalCase icon names', () => {
    expect(filterIconNames(['AirplaneTakeOff01Icon', 'AirplaneLanding01Icon'], 'ato')).toEqual([
      'AirplaneTakeOff01Icon',
    ]);
  });

  it('suggests broad prefixes and narrows suggestions as the prefix becomes specific', () => {
    expect(getSearchSuggestions('avi')).toEqual(expect.arrayContaining(['avion', 'aviso']));
    expect(getSearchSuggestions('avio')).toEqual(expect.arrayContaining(['avion']));
    expect(getSearchSuggestions('avio')).not.toEqual(expect.arrayContaining(['aviso']));
  });
});
