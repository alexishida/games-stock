# library-management-workflows Specification

## Purpose
TBD - created by archiving change complete-library-management-workflows. Update Purpose after archive.
## Requirements
### Requirement: Manual game creation workflow
The system SHALL allow users to create a game manually from the library UI without using LaunchBox import. The form SHALL require title and platform, and SHALL allow optional publisher, year, genre, rating, notes, physical ownership, physical condition, and ROM or box art actions after creation.

#### Scenario: Create game with required fields
- **WHEN** the user opens the manual game form, enters a title, selects a platform, and saves
- **THEN** the game is persisted, the library refreshes, and the created game can be selected in the grid or list

#### Scenario: Missing required fields
- **WHEN** the user tries to save a manual game without title or platform
- **THEN** the form displays a validation error and no game is created

### Requirement: Game deletion workflow
The system SHALL allow users to delete a selected game from the detail view after confirming the destructive action.

#### Scenario: Confirm game deletion
- **WHEN** the user clicks delete for a selected game and confirms
- **THEN** the game is removed from the database, the detail panel closes, and the library refreshes

#### Scenario: Cancel game deletion
- **WHEN** the user clicks delete for a selected game and cancels the confirmation
- **THEN** the game remains unchanged and selected

### Requirement: Collection status workflow
The system SHALL allow users to mark a game as favorite and set play status to "unplayed", "playing", or "completed". These values SHALL be persisted and available as library filters.

#### Scenario: Mark game as favorite
- **WHEN** the user enables favorite on a game and saves
- **THEN** the game remains marked as favorite after refresh or app restart

#### Scenario: Set completed status
- **WHEN** the user sets a game's play status to "completed" and saves
- **THEN** the game appears when the completed filter is active

