/**
 * Copyright Whitebox Software Ltd. 2014
 * All Rights Reserved.

 * Created by chris on 02/01/15.

 */
package io.venuu.vuu.viewport

import com.typesafe.scalalogging.LazyLogging
import io.venuu.toolbox.collection.array.ImmutableArray
import io.venuu.toolbox.time.Clock
import io.venuu.vuu.core.sort.{FilterAndSort, TwoStepCompoundFilter, UserDefinedFilterAndSort, VisualLinkedFilter}
import io.venuu.vuu.core.table.{Column, KeyObserver, RowKeyUpdate}
import io.venuu.vuu.net.{ClientSessionId, FilterSpec}
import io.venuu.vuu.util.PublishQueue

import java.util
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference

class ViewPortUpdateType
case object RowUpdateType extends ViewPortUpdateType
case object SizeUpdateType extends ViewPortUpdateType

object DefaultRange extends ViewPortRange(0, 123)

case class ViewPortSelectedIndices(indices: Array[Int])

case class ViewPortSelection(map: Map[String, Int])

case class ViewPortVisualLink(childVp: ViewPort, parentVp: ViewPort, childColumn: Column, parentColumn: Column){
  override def toString: String = "ViewPortVisualLink(" + childVp.id + "->" + parentVp.id + ", on " + childColumn.name + " = " + parentColumn.name + ")"
}

case class ViewPortRange(from: Int, to: Int){
  def contains(i: Int): Boolean = {
    i >= from && i < to
  }

  def subtract(newRange: ViewPortRange): ViewPortRange ={
        var from = newRange.from
        var to = newRange.to

        if(newRange.from > this.from && newRange.from < this.to){
            from = this.to
            to = newRange.to
        }

        if(newRange.from < this.from && newRange.to < this.to && newRange.to > this.from){
            from = newRange.from
            to   = this.from
        }

        ViewPortRange(from, to)
  }

}

case class ViewPortUpdate(vp: ViewPort, table: RowSource, key: RowKeyUpdate, index: Int, vpUpdate: ViewPortUpdateType, size: Int, ts: Long)

trait ViewPort {
  def setEnabled(enabled: Boolean)
  def isEnabled: Boolean
  def hasGroupBy: Boolean = getGroupBy != NoGroupBy
  def size: Int
  def id: String
  def filterAndSort: FilterAndSort
  def session: ClientSessionId
  def table: RowSource
  def setRange(range: ViewPortRange)
  def setSelection(rowIndices: Array[Int])
  def setVisualLink(link: ViewPortVisualLink)
  def removeVisualLink()
  def getRange(): ViewPortRange
  def setKeys(keys: ImmutableArray[String])
  def setKeysAndNotify(key: String, keys: ImmutableArray[String])
  def getKeys() : ImmutableArray[String]
  def getKeysInRange() : ImmutableArray[String]
  def getVisualLink(): Option[ViewPortVisualLink]
  def outboundQ: PublishQueue[ViewPortUpdate]
  def highPriorityQ: PublishQueue[ViewPortUpdate]
  def getColumns: List[Column]
  def getSelection: Map[String, Int]
  def getRowKeyMappingSize_ForTest: Int
  def getGroupBy: GroupBy
  def combinedQueueLength = highPriorityQ.length + outboundQ.length
  def filterSpec: FilterSpec
  def changeStructure(newStructuralFields: ViewPortStructuralFields): Unit
  def getTreeNodeState: TreeNodeState
  def getStructure: ViewPortStructuralFields
  def ForTest_getSubcribedKeys: ConcurrentHashMap[String, String]
  def ForTest_getRowKeyToRowIndex: ConcurrentHashMap[String, Int]
  override def toString: String = "VP(user:" + session.user + ",table:" + table.name + ",size: " + size + ",id:" + id + ") @" + session.sessionId
  def delete(): Unit
}

//when we make a structural change to the viewport, it is via one of these fields
case class ViewPortStructuralFields(table: RowSource, columns: List[Column], filtAndSort: FilterAndSort, filterSpec: FilterSpec, groupBy: GroupBy, theTreeNodeState: TreeNodeState)

case class ViewPortImpl(id: String,
                        //table: RowSource,
                        session: ClientSessionId,
                        outboundQ: PublishQueue[ViewPortUpdate],
                        highPriorityQ: PublishQueue[ViewPortUpdate],
                        structuralFields: AtomicReference[ViewPortStructuralFields],
                        range: AtomicReference[ViewPortRange]
                       )(implicit timeProvider: Clock) extends ViewPort with KeyObserver[RowKeyUpdate] with LazyLogging{

  private val viewPortLock = new Object

  @volatile private var enabled = true

  override def setEnabled(enabled: Boolean): Unit = {
    this.enabled = enabled
  }

  override def isEnabled: Boolean = this.enabled

  @volatile
  private var viewPortVisualLink: Option[ViewPortVisualLink] = None

  override def table: RowSource = structuralFields.get().table

  override def getStructure: ViewPortStructuralFields = structuralFields.get()

  override def getTreeNodeState: TreeNodeState = structuralFields.get().theTreeNodeState

  private def onlyFilterOrSortChanged(newStructuralFields: ViewPortStructuralFields, current: ViewPortStructuralFields): Boolean = {
    newStructuralFields.table.asTable.name == current.table.asTable.name && newStructuralFields.groupBy == current.groupBy && newStructuralFields.columns == current.columns
  }

  def changeStructure(newStructuralFields: ViewPortStructuralFields): Unit = {

    val onlySortOrFilterChange = onlyFilterOrSortChanged(newStructuralFields, structuralFields.get())

    structuralFields.set(newStructuralFields)

    if(!onlySortOrFilterChange)
      sendUpdatesOnChange(range.get())
  }

  override def setSelection(rowIndices: Array[Int]): Unit = {
    viewPortLock.synchronized{
      val oldSelection = selection.map(kv => (kv._1, this.rowKeyToIndex.get(kv._1)) ).toMap[String, Int]
      selection = rowIndices.filter(this.keys(_) != null).map( idx => (this.keys(idx), idx) ).toMap
      for( (key, idx ) <- selection ++ oldSelection ){
        publishHighPriorityUpdate(key, idx)
      }
    }
  }

  override def getSelection: Map[String, Int] = selection

  def setRange(newRange: ViewPortRange): Unit = {
    viewPortLock.synchronized{
      val oldRange = range.get()

      removeSubscriptionsForRange(oldRange)

      range.set(newRange)

      addSubscriptionsForRange(newRange)

      val diffRange = oldRange.subtract(newRange)
      sendUpdatesOnChange(diffRange)
    }
  }

  def removeSubscriptionsForRange(range: ViewPortRange) = {
    (range.from to (range.to - 1 )).foreach( i=>{
      val key = if(keys.length > i ) keys(i) else null
      if(key != null ) {
        unsubscribeForKey(key)
      }
    })
  }

  def addSubscriptionsForRange(range: ViewPortRange) = {
    (range.from to (range.to - 1 )).foreach( i=>{
      val key = if(keys.length > i ) keys(i) else null
      if(key != null) {
        subscribeForKey(key, i)
      }
    })
  }

  //def setColumns(columns: List[Column])
  override def filterSpec: FilterSpec = structuralFields.get().filterSpec

  def sendUpdatesOnChange(currentRange: ViewPortRange) = {

    val currentKeys = keys.toArray

    val from = currentRange.from
    val to = currentRange.to

    val inrangeKeys = currentKeys.drop(from).take(to - from)

    inrangeKeys.zip((from to to)).foreach({ case(key, index) => publishHighPriorityUpdate(key, index)})
  }

  override def getColumns: List[Column] = structuralFields.get().columns

  override def getRange(): ViewPortRange = range.get()

  override def getGroupBy: GroupBy = structuralFields.get().groupBy

  override def size: Int = keys.length

  override def getRowKeyMappingSize_ForTest: Int = rowKeyToIndex.size()

  override def filterAndSort: FilterAndSort = structuralFields.get().filtAndSort

  @volatile
  private var keys : ImmutableArray[String] = ImmutableArray.from[String](new Array[String](0))
  @volatile
  private var selection : Map[String, Int] = Map()

  private val subscribedKeys = new ConcurrentHashMap[String, String]()
  private val rowKeyToIndex = new ConcurrentHashMap[String, Int]()

  override def ForTest_getSubcribedKeys = subscribedKeys
  override def ForTest_getRowKeyToRowIndex = rowKeyToIndex

  override def getKeys(): ImmutableArray[String] = keys

  override def delete(): Unit = {
      this.setKeys(ImmutableArray.empty[String])
  }

  override def getKeysInRange(): ImmutableArray[String] = {
    val currentKeys = keys.toArray

    val activeRange = range.get()

    val from = activeRange.from
    val to = activeRange.to

    val inrangeKeys = currentKeys.drop(from).take(to - from)

    ImmutableArray.from(inrangeKeys)
  }

  def setKeysPre(newKeys: ImmutableArray[String]): Unit ={
    //send ViewPort
    removeNoLongerSubscribedKeys(newKeys)
  }

  def setKeysInternal(newKeys: ImmutableArray[String]): Unit ={
    keys = newKeys
  }

  def setKeysPost(sendSizeUpdate: Boolean, newKeys: ImmutableArray[String]): Unit = {
    if(sendSizeUpdate){
      highPriorityQ.push(new ViewPortUpdate(this, null, new RowKeyUpdate("SIZE", null), -1, SizeUpdateType, newKeys.length, timeProvider.now()))
    }
    subscribeToNewKeys(newKeys)
  }

  override def setKeysAndNotify(key: String, newKeys: ImmutableArray[String]): Unit = {
    val sendSizeUpdate = newKeys.length != keys.length
    setKeysPre(newKeys)
    setKeysInternal(newKeys)
    table.notifyListeners(key, false)
    setKeysPost(sendSizeUpdate, newKeys)
  }

  override def setKeys(newKeys: ImmutableArray[String]): Unit = {
    val sendSizeUpdate = newKeys.length != keys.length
    setKeysPre(newKeys)
    setKeysInternal(newKeys)
    //keys = newKeys
    setKeysPost(sendSizeUpdate, newKeys)
  }

  override def onUpdate(update: RowKeyUpdate): Unit = {

    val index = rowKeyToIndex.get(update.key)

    logger.debug(s"VP got update for ${update.key} update, index = ${index} isDeleted = ${update.isDelete}, $update, pushing to queue")

    if(isInRange(index) && this.enabled){
        outboundQ.push(new ViewPortUpdate(this, update.source, RowKeyUpdate(update.key, update.source, update.isDelete), index, RowUpdateType, this.keys.length, timeProvider.now()))
    }

  }

  protected def isInRange(i: Int) = range.get().contains(i)

  protected def isObservedAlready(key: String): Boolean = subscribedKeys.get(key) != null

  protected def hasChangedIndex(oldIndex: Int, newIndex: Int) = oldIndex != newIndex

  protected def subscribeToNewKeys(newKeys: ImmutableArray[String]) = {

    var index = 0

    var newlyAddedObs = 0

    var removedObs = 0

    while(index < newKeys.length){

      val key = newKeys(index)

      val oldIndex = rowKeyToIndex.put(key, index)

      if(isInRange(index)){

        if(!isObservedAlready(key)){

          subscribeForKey(key, index)

          newlyAddedObs += 1

          publishHighPriorityUpdate(key, index)

        }else if(hasChangedIndex(oldIndex, index)){
          publishHighPriorityUpdate(key, index)
        }

      }else{
        unsubscribeForKey(key)
        removedObs += 1
      }

      index += 1
    }

    if(newlyAddedObs > 0 )
      logger.info(s"[VP] ${this.id} Added $newlyAddedObs Removed ${removedObs} Obs ${this.table}")
  }


  protected def removeNoLongerSubscribedKeys(newKeys: ImmutableArray[String]) = {
    val newKeySet = new util.HashSet[String]()

    var i = 0

    //TODO: CJS this is not correct, we should only subscribe to keys within the VP range
    //this will check every key and remove it
    while(i < newKeys.length){
      newKeySet.add(newKeys(i))
      i += 1
    }

    val iterator = subscribedKeys.entrySet().iterator()

    while(iterator.hasNext){
      val oldEntry = iterator.next()
      val oldKey = oldEntry.getKey
      if(!newKeySet.contains(oldKey)){
        unsubscribeForKey(oldKey)
      }
    }
  }

  def unsubscribeForKey(key: String){
    subscribedKeys.remove(key)
    rowKeyToIndex.remove(key)
    removeObserver(key)
  }

  def subscribeForKey(key: String, index: Int){
    subscribedKeys.put(key, "-")
    rowKeyToIndex.put(key, index)
    addObserver(key)
  }

  def publishHighPriorityUpdate(key: String, index: Int) = {
    logger.debug(s"publishing update ${key}")
    if(this.enabled) {
      highPriorityQ.push(new ViewPortUpdate(this, table, new RowKeyUpdate(key, table), index, RowUpdateType, this.keys.length, timeProvider.now))
    }
  }

  private def addObserver(key: String) = {
    //logger.info("adding observer for key:" + key)
    table.addKeyObserver(key, this)
  }

  private def removeObserver(oldKey: String) = {
    if(table.isKeyObservedBy(oldKey, this)) {
      //logger.info("removing observer for key:" + oldKey)
      table.removeKeyObserver(oldKey, this)
    }
  }

  override def setVisualLink(link: ViewPortVisualLink): Unit = {
    viewPortLock.synchronized{
      val fields = this.structuralFields.get()
      val newFilterSort = fields.filtAndSort match {
        case udfs: UserDefinedFilterAndSort =>
          UserDefinedFilterAndSort(TwoStepCompoundFilter( VisualLinkedFilter(link), udfs.filter), udfs.sort)
        case x =>
          x
      }

      //set the filter and sort to include the selection filter
      this.structuralFields.set(fields.copy( filtAndSort = newFilterSort))
    }
  }

  override def removeVisualLink(): Unit = {
    viewPortLock.synchronized{
      this.viewPortVisualLink = None
    }
  }

  override def getVisualLink(): Option[ViewPortVisualLink] = this.viewPortVisualLink
}
