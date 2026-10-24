# Storage: how the game computes it (4.5.2)

Read from the game files on 2026-10-24. The save does not store the result — companion mod 0.5.0
exports it (`sdash_m_<res>`, `AGENTS.md` → Companion mod); without the mod the dashboard shows ≈
the base. **Never measure with `instant_build` on**: it sets every country's storage to 1,000,000.

Confirmed by the mod in a throwaway game, one change per monthly autosave:

- 2200.05.01: the base; fallen empires +120,000 (`fallen_empire_base` + Mega-Engineering); bio
  ships food +10,000, alloys −2,500.
- 2200.08.01: the planet Resource Silo with Construction Templates, +10,000.
- 2200.09.01: Mega-Engineering, +20,000.
- 2201.03.01: the starbase Resource Silo with Construction Templates, +10,000 (saved as
  `resource_silo` in the starbase's buildings).
- Influence stayed at 1,000 through all of them.

The other rows wait for the same treatment.

**max = base + Resource Storage Capacity (`country_resource_max_add`, every resource) + the
resource's own `country_resource_max_<res>_add` + its `dynamic_capacity`.** Resources with
`special_max_amount = yes` (minor artifacts, astral threads) ignore the general modifier
(`common/strategic_resources/00_strategic_resources.txt`, header comment). **So does influence**,
without that flag: it stayed at 1,000 when a silo raised everything else by 10,000 (2200.08.01). The game's own
`max_paperclip_capacity` script value adds them up the same way.

## Base (`max` in `common/strategic_resources/`)

Energy 25,000 · minerals, food, consumer goods, alloys, volatile motes, exotic gases, rare
crystals, living metal, zro, dark matter 15,000 · trade 50,000 · influence 1,000 · minor
artifacts 2,000 · astral threads 500. Unity, research and nanites have none.

## What adds to it

| Source                                            | File                                                                    | Adds                                            | To                              |
| ------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------- |
| Resource Silo (planet building)                   | `buildings/03_resource_buildings.txt`                                   | +5,000, +5,000 more with Construction Templates | all                             |
| — under Obsessional Directive                     | same                                                                    | +5,000                                          | consumer goods                  |
| Resource Silo (starbase building)                 | `starbase_buildings/00_starbase_buildings.txt`                          | +5,000, or +10,000 with Construction Templates  | all                             |
| Arkship Resource Silo                             | `starbase_buildings/00_arkship_colony_buildings.txt`                    | +5,000 / +10,000 (as above)                     | all                             |
| Waystation Resource Silo (nomads)                 | `starbase_modules/00_waystation_modules.txt`                            | +500 / +1,000 (Construction Templates)          | all                             |
| Subterranean Cache (wilderness)                   | `buildings/21_wilderness_buildings.txt`                                 | +5,000, +5,000 more with Construction Templates | all                             |
| Mega-Engineering (tech)                           | `technology/00_megastructures.txt`                                      | +20,000                                         | all                             |
| Galactic Market founded (resolution)              | `resolutions/00_resolutions.txt`                                        | +10,000                                         | all                             |
| Universal Prosperity Mandate (resolution)         | `static_modifiers/11_static_modifiers_federations.txt`                  | −10,000                                         | all                             |
| Preservation Chamber (relic)                      | `relics/grand_archive_relics.txt`                                       | +25,000                                         | all                             |
| Fallen empire (`fallen_empire_base`)              | `static_modifiers/00_static_modifiers.txt`                              | +100,000                                        | all                             |
| Fallen empire silos 1 / 2                         | `buildings/13_fallen_empire_buildings.txt`                              | +50,000 / +100,000                              | all                             |
| AI difficulty, Captain … Grand Admiral (AI only)  | `static_modifiers/00_static_modifiers.txt`                              | +2,500 … +10,000                                | all                             |
| Obsessional Directive (civic)                     | `governments/civics/02_gestalt_civics.txt`                              | +15,000                                         | consumer goods                  |
| Dyson gun, stages 1–3                             | `megastructures/31_dyson_gun.txt`                                       | +5,000 / +10,000 / +20,000                      | energy                          |
| Behemoth menace perk                              | `menace_perks/00_menace_perks.txt`                                      | +100,000                                        | food                            |
| Dark matter crisis cap (`crisis_dark_matter_cap`) | `static_modifiers/13_static_modifiers_nemesis.txt`                      | +185,000                                        | dark matter                     |
| Bio ships (`dynamic_capacity`)                    | `strategic_resources/00_strategic_resources.txt`                        | food +10,000, alloys −2,500                     | food, alloys                    |
| Archaeostudies Faculty, astral siphons            | `buildings/05_research_buildings.txt`, `18_astral_planes_buildings.txt` | own resource only                               | minor artifacts, astral threads |

Computing this without the mod is an open task (`docs/open-checks.md` § 14).
