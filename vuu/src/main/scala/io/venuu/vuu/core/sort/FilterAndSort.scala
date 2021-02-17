/**
 * Copyright Whitebox Software Ltd. 2014
 * All Rights Reserved.

 * Created by chris on 02/01/15.

 */
package io.venuu.vuu.core.sort

import com.typesafe.scalalogging.StrictLogging
import io.venuu.toolbox.ImmutableArray
import io.venuu.vuu.core.filter.{Filter, FilterClause}
import io.venuu.vuu.viewport.{RowSource, ViewPortVisualLink}

case class VisualLinkedFilter(viewPortVisualLink: ViewPortVisualLink) extends Filter {

  override def dofilter(source: RowSource, primaryKeys: ImmutableArray[String]): ImmutableArray[String] = {

    val parentSelectionKeys = viewPortVisualLink.parentVp.getSelection
    val parentColumn        = viewPortVisualLink.parentColumn
    val childColumn         = viewPortVisualLink.childColumn

    val parentDataValues    = parentSelectionKeys.map( key =>  (viewPortVisualLink.parentVp.table.pullRowAsArray(key._1, List(parentColumn) )(0) -> 0 )).toMap
    val pks                 = primaryKeys.toArray
    val childColumns        = List(childColumn)

    val filtered = pks.filter( key => {
        val childField = source.pullRow(key, childColumns).get(childColumn)
        parentDataValues.contains(childField)
    })

    ImmutableArray.from(filtered)
  }
}

case class TwoStepCompoundFilter(first: Filter, second: Filter) extends Filter with StrictLogging{
  override def dofilter(source: RowSource, primaryKeys: ImmutableArray[String]): ImmutableArray[String] = {

    val firstStep           = first.dofilter(source, primaryKeys)

    val secondStep          = second.dofilter(source, firstStep)

    secondStep
  }
}

case class AntlrBasedFilter(clause: FilterClause) extends Filter with StrictLogging{

  override def dofilter(source: RowSource, primaryKeys: ImmutableArray[String]): ImmutableArray[String] = {

    val columns = source.asTable.getTableDef.columns.toList

    val pks = primaryKeys.toArray

    logger.info(s"starting filter with ${pks.length}")

    val filtered = pks.filter( key => {
        clause.filter(source.pullRow(key, columns))
    })

    logger.info(s"ended filter with ${filtered.length}")

    ImmutableArray.from(filtered)
  }
}


trait FilterAndSort {
  def filterAndSort(source: RowSource, primaryKeys: ImmutableArray[String]): ImmutableArray[String]
}

case class UserDefinedFilterAndSort(filter: Filter, sort: Sort) extends FilterAndSort with StrictLogging{

  override def filterAndSort(source: RowSource, primaryKeys: ImmutableArray[String]): ImmutableArray[String] = {
    try {
      val filteredKeys = filter.dofilter(source, primaryKeys)
      val sortedKeys = sort.doSort(source, filteredKeys)
      logger.debug("sorted")
      sortedKeys
    }catch{
      case e: Throwable =>
        logger.error("went bad", e)
        debugData(source, primaryKeys)
        primaryKeys
    }
  }

  def debugData(source: RowSource, keys: ImmutableArray[String]): Unit = {
    val data = keys.toArray.map(key => source.pullRowAsArray(key, source.asTable.getTableDef.columns.toList))
    println()
  }
}

class NoFilterNoSort() extends FilterAndSort{

  override def filterAndSort(source: RowSource, primaryKeys: ImmutableArray[String]): ImmutableArray[String] = {
    primaryKeys
  }
}


