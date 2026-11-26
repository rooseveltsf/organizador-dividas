export function shoppingListPath(profileId: string, itemId?: string) {
  const list = '/profiles/' + encodeURIComponent(profileId) + '/shopping-list';
  return itemId ? list + '/' + encodeURIComponent(itemId) : list;
}
